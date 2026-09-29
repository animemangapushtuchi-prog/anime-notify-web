// 作品の公式サイトから「放送・配信」に関する文章を取り出す（サーバー専用）。
//
// 方針
// - ログイン不要の公開ページだけを、1作品あたり最大3ページ読む（トップ＋放送/配信ページ2つ）
// - robots.txt で拒否されているページは読まない
// - アクセス元を名乗る（User-Agent に連絡先を入れる）。ブロック回避のための偽装はしない
// - 画面の中身を後からJavaScriptで描くサイトは、ここでは読めない → 呼び出し側で「読めなかった」扱い
//
// このファイルは外部ライブラリや @/ の別名を使わない（単体でも動作確認できるように）。

export const CRAWLER_UA =
  "AnimiruBot/1.0 (+https://www.animiru.com; contact: animemangapushtuchi@gmail.com)";

const FETCH_TIMEOUT_MS = 12000;
const MAX_BYTES = 2_000_000;
const MAX_SUBPAGES = 2;
// 1ページから Claude に渡す文字数の上限
const MAX_RELEVANT_CHARS = 8000;

export type OfficialPage = { url: string; text: string };

export type OfficialResult =
  | { status: "ok"; pages: OfficialPage[] }
  | { status: "blocked" | "unreachable" | "empty"; pages: OfficialPage[]; reason: string };

// 放送・配信ページらしいリンクの手がかり
const SUBPAGE_HINT =
  /on[-_]?air|broadcast|stream|haishin|放送|配信|視聴/i;

// 本文から残す行の手がかり（配信サービス名・放送/配信・日付表現）
const RELEVANT_LINE =
  /Prime\s*Video|プライム|Amazon|Netflix|ネットフリックス|U-?NEXT|dアニメ|ABEMA|アベマ|Hulu|DMM|Lemino|FOD|TELASA|Disney|ディズニー|ニコニコ|niconico|バンダイチャンネル|アニメタイムズ|放送|配信|見放題|毎週|月曜|火曜|水曜|木曜|金曜|土曜|日曜|\d{1,2}月\d{1,2}日|\d{1,2}:\d{2}|\d{1,2}時/i;

// 内部ネットワーク等への誤アクセスを防ぐ（URLは AniList 由来だが念のため）
export function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".")) return false; // localhost など
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false; // IPv4 直指定
  if (h.includes(":") || h.startsWith("[")) return false; // IPv6 直指定
  if (/\.(local|internal|localhost|lan|home|corp)$/.test(h)) return false;
  return true;
}

function sameSite(a: URL, b: URL): boolean {
  const strip = (h: string) => h.replace(/^www\./, "");
  return strip(a.hostname) === strip(b.hostname);
}

// ---- robots.txt ----
// User-agent: * と AnimiruBot のグループの Disallow/Allow だけを見る簡易版
const robotsCache = new Map<string, { allow: string[]; disallow: string[] } | null>();

async function robotsRules(origin: string) {
  if (robotsCache.has(origin)) return robotsCache.get(origin)!;
  let rules: { allow: string[]; disallow: string[] } | null = null;
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": CRAWLER_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
      cache: "no-store",
    });
    if (res.ok) {
      const txt = await res.text();
      rules = { allow: [], disallow: [] };
      let applies = false;
      let inAgents = false;
      for (const line of txt.split(/\r?\n/)) {
        const l = line.replace(/#.*/, "").trim();
        if (!l) continue;
        const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(l);
        if (!m) continue;
        const key = m[1].toLowerCase();
        const val = m[2].trim();
        if (key === "user-agent") {
          const ua = val.toLowerCase();
          const hit = ua === "*" || ua.includes("animirubot");
          applies = inAgents ? applies || hit : hit;
          inAgents = true;
        } else {
          inAgents = false;
          if (!applies) continue;
          if (key === "disallow" && val) rules.disallow.push(val);
          if (key === "allow" && val) rules.allow.push(val);
        }
      }
    }
  } catch {
    rules = null; // 取得できない場合は制限なしとして扱う（一般的な解釈）
  }
  robotsCache.set(origin, rules);
  return rules;
}

async function robotsAllows(url: URL): Promise<boolean> {
  const rules = await robotsRules(url.origin);
  if (!rules) return true;
  const path = url.pathname + url.search;
  const longest = (list: string[]) =>
    list.filter((p) => path.startsWith(p.replace(/\*.*$/, ""))).reduce((n, p) => Math.max(n, p.length), -1);
  return longest(rules.allow) >= longest(rules.disallow);
}

// ---- 取得と文字コード ----
async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": CRAWLER_UA, Accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
    cache: "no-store",
  });
  if (!res.ok) return null;
  const ctype = res.headers.get("content-type") ?? "";
  if (ctype && !/html|xml/i.test(ctype)) return null;
  const buf = new Uint8Array(await res.arrayBuffer()).slice(0, MAX_BYTES);

  // 日本の公式サイトには Shift_JIS / EUC-JP も残っているので、宣言に従って読み分ける
  let charset = (/charset=([\w-]+)/i.exec(ctype)?.[1] ?? "").toLowerCase();
  if (!charset) {
    const head = new TextDecoder("latin1").decode(buf.slice(0, 4096));
    charset = (/<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ?? "utf-8").toLowerCase();
  }
  if (charset === "x-sjis" || charset === "sjis") charset = "shift_jis";
  let html: string;
  try {
    html = new TextDecoder(charset).decode(buf);
  } catch {
    html = new TextDecoder("utf-8").decode(buf);
  }
  return { html, finalUrl: res.url || url };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

export function htmlToText(html: string): string {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ");
  // 画像の代替文字（配信サービスのロゴに名前が入っていることが多い）を残す
  s = s.replace(/<img[^>]*\balt=["']([^"']+)["'][^>]*>/gi, " $1 ");
  s = s.replace(/<(br|\/p|\/li|\/tr|\/div|\/h[1-6]|\/dt|\/dd|\/section|\/article)\b[^>]*>/gi, "\n");
  s = s.replace(/<\/t[dh]>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t　]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

// 放送・配信に関係する行と、その前後1行だけを残す
export function relevantText(text: string): string {
  const lines = text.split("\n");
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    if (RELEVANT_LINE.test(l)) for (const j of [i - 1, i, i + 1]) if (j >= 0 && j < lines.length) keep.add(j);
  });
  const out = [...keep].sort((a, b) => a - b).map((i) => lines[i]).join("\n");
  return out.slice(0, MAX_RELEVANT_CHARS);
}

function findSubpages(html: string, base: URL): string[] {
  const scored: { url: string; score: number }[] = [];
  const re = /<a\b[^>]*\bhref=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    let u: URL;
    try {
      u = new URL(decodeEntities(m[1]), base);
    } catch {
      continue;
    }
    if (!sameSite(u, base) || u.href === base.href) continue;
    const label = htmlToText(m[2]);
    let score = 0;
    if (SUBPAGE_HINT.test(u.pathname)) score += 2;
    if (SUBPAGE_HINT.test(label)) score += 2;
    if (/onair|on_air|on-air/i.test(u.pathname)) score += 1;
    if (score > 0) scored.push({ url: u.href, score });
  }
  const seen = new Set<string>();
  return scored
    .sort((a, b) => b.score - a.score)
    .map((s) => s.url)
    .filter((u) => (seen.has(u) ? false : (seen.add(u), true)))
    .slice(0, MAX_SUBPAGES);
}

export async function collectOfficialPages(officialUrl: string): Promise<OfficialResult> {
  if (!isSafePublicUrl(officialUrl)) {
    return { status: "unreachable", pages: [], reason: "URLが不正です" };
  }
  const top = new URL(officialUrl);
  if (!(await robotsAllows(top))) {
    return { status: "blocked", pages: [], reason: "robots.txt で読み取りが禁止されています" };
  }

  let first: { html: string; finalUrl: string } | null = null;
  try {
    first = await fetchHtml(top.href);
  } catch {
    first = null;
  }
  if (!first) return { status: "unreachable", pages: [], reason: "公式サイトを開けませんでした" };

  const pages: OfficialPage[] = [];
  const topText = relevantText(htmlToText(first.html));
  if (topText) pages.push({ url: first.finalUrl, text: topText });

  for (const sub of findSubpages(first.html, new URL(first.finalUrl))) {
    const u = new URL(sub);
    if (!isSafePublicUrl(u.href) || !(await robotsAllows(u))) continue;
    try {
      const r = await fetchHtml(u.href);
      if (!r) continue;
      const t = relevantText(htmlToText(r.html));
      if (t) pages.push({ url: r.finalUrl, text: t });
    } catch {
      /* 1ページ読めなくても続ける */
    }
  }

  if (pages.length === 0) {
    return {
      status: "empty",
      pages,
      reason: "放送・配信の文章が見つかりませんでした（画面をJavaScriptで描くサイトの可能性）",
    };
  }
  return { status: "ok", pages };
}
