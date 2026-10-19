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

// links: そのページにあった「配信サービスの作品ページ」へのリンク（サービスキー → URL の一覧）
export type OfficialPage = { url: string; text: string; links?: Record<string, string[]> };

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
async function fetchHtml(
  url: string,
  info?: { status?: number } // 失敗の理由を呼び出し側で分けるため、HTTPの状態コードを返す
): Promise<{ html: string; finalUrl: string } | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": CRAWLER_UA, Accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
    cache: "no-store",
  });
  if (info) info.status = res.status;
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

// 配信サービスのドメイン → 名前（lib/extractStreaming.ts の SERVICES が読める表記）。
// 公式サイトがサービスをロゴ画像とリンクだけで並べている場合に、リンクの行き先から名前を補うために使う
const SERVICE_DOMAINS: { re: RegExp; name: string }[] = [
  { re: /(^|\.)abema\.tv$/, name: "ABEMA" },
  { re: /(^|\.)animestore\.docomo\.ne\.jp$/, name: "dアニメストア" },
  { re: /(^|\.)video\.unext\.jp$/, name: "U-NEXT" },
  { re: /(^|\.)netflix\.com$/, name: "Netflix" },
  { re: /(^|\.)disneyplus\.com$/, name: "Disney+" },
  { re: /(^|\.)tv\.dmm\.com$/, name: "DMM TV" },
  { re: /(^|\.)fod\.fujitv\.co\.jp$/, name: "FOD" },
  { re: /(^|\.)hulu\.jp$/, name: "Hulu" },
  { re: /(^|\.)lemino\.docomo\.ne\.jp$/, name: "Lemino" },
  { re: /(^|\.)telasa\.jp$/, name: "TELASA" },
  { re: /(^|\.)b-ch\.com$/, name: "バンダイチャンネル" },
  { re: /(^|\.)nicovideo\.jp$/, name: "ニコニコ" },
  { re: /(^|\.)primevideo\.com$/, name: "Prime Video" },
];
function serviceNameOfUrl(href: string): string | null {
  let u: URL;
  try {
    u = new URL(decodeEntities(href));
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  // Amazon は作品ページ（/gp/video/detail/…）だけを Prime Video とみなす（チャンネルや物販のリンクと区別するため）
  if (/(^|\.)amazon\.co\.jp$/.test(host)) return /\/gp\/video\/detail\//.test(u.pathname) ? "Prime Video" : null;
  return SERVICE_DOMAINS.find((d) => d.re.test(host))?.name ?? null;
}

// ---- 配信サービスの作品ページへのリンク ----
// 公式サイトが各配信サービスの「作品ページ」にリンクしていれば、そのURLを集める（見る人がそのまま飛べるように）。
// 推測でURLを作らないため、公式サイトに書かれたリンクだけを使い、作品ページの形をしたものだけを認める。
// keep: 作品を表す引数（無ければ作品ページではない）／ optional: あれば残す引数（ABEMA の ?s= はシーズンの指定）
const WATCH_PAGE: { key: string; host: RegExp; path: RegExp; keep?: string[]; optional?: string[] }[] = [
  { key: "abema", host: /(^|\.)abema\.tv$/, path: /^\/video\/title\/[^/]+/, optional: ["s"] },
  { key: "d-anime", host: /(^|\.)animestore\.docomo\.ne\.jp$/, path: /^\/animestore\/ci(_pc)?\/?$/, keep: ["workId"] },
  { key: "u-next", host: /(^|\.)video\.unext\.jp$/, path: /^\/title\/SID\d+/ },
  { key: "netflix", host: /(^|\.)netflix\.com$/, path: /^(\/[a-z]{2}(-[a-z]{2})?)?\/title\/\d+/i },
  { key: "disney-plus", host: /(^|\.)disneyplus\.com$/, path: /\/(series|movies|browse\/entity-)[^?]*/ },
  { key: "dmm-tv", host: /(^|\.)tv\.dmm\.com$/, path: /^\/vod\/detail\/?$/, keep: ["season", "content"] },
  { key: "fod", host: /(^|\.)fod\.fujitv\.co\.jp$/, path: /^\/title\/[^/]+/ },
  { key: "hulu", host: /(^|\.)hulu\.jp$/, path: /^\/[a-z0-9-]{3,}\/?$/ },
  { key: "lemino", host: /(^|\.)lemino\.docomo\.ne\.jp$/, path: /^\/(contents|ft)\/[^/]+/ },
  { key: "telasa", host: /(^|\.)telasa\.jp$/, path: /^\/(series|videos)\/\d+/ },
  { key: "bandai-channel", host: /(^|\.)b-ch\.com$/, path: /^\/titles\/\d+/ },
  { key: "niconico", host: /^anime\.nicovideo\.jp$/, path: /^\/detail\/[^/]+/ },
  { key: "niconico", host: /^(www\.)?nicovideo\.jp$/, path: /^\/series\/\d+/ },
  { key: "niconico", host: /^ch\.nicovideo\.jp$/, path: /^\/[a-z0-9_-]{3,}\/?$/i },
  { key: "prime-video", host: /(^|\.)amazon\.co\.jp$/, path: /\/gp\/video\/detail\/[A-Z0-9]+/ },
  { key: "prime-video", host: /(^|\.)primevideo\.com$/, path: /\/detail\/[A-Za-z0-9.]+/ },
];
function watchPageOf(href: string, base: URL): { key: string; url: string } | null {
  let u: URL;
  try {
    u = new URL(decodeEntities(href), base);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  for (const w of WATCH_PAGE) {
    if (!w.host.test(host) || !w.path.test(u.pathname)) continue;
    const clean = new URL(u.origin + u.pathname.replace(/\/+$/, ""));
    for (const k of w.keep ?? []) {
      const v = u.searchParams.get(k);
      if (v) clean.searchParams.set(k, v);
    }
    // d アニメストアと DMM TV は、作品を表す引数が無ければ作品ページではない
    if (w.keep && ![...clean.searchParams.keys()].length) return null;
    for (const k of w.optional ?? []) {
      const v = u.searchParams.get(k);
      if (v) clean.searchParams.set(k, v);
    }
    return { key: w.key, url: clean.toString() };
  }
  return null;
}

// リンクの文字（またはロゴの代替文字）が別のサービス名なら、行き先のドメインでサービスを決めない
// 例：「dアニメストア for Prime Video」→ amazon.co.jp、「アニメ放題」→ U-NEXT系 など
const LINK_TEXT_OTHER: Record<string, RegExp> = {
  "prime-video": /dアニメ|アニメタイムズ|for\s*Prime|チャンネル/i,
  "u-next": /アニメ放題/,
  niconico: /dアニメ/,
};

export function serviceWatchLinks(html: string, baseUrl: string): Record<string, string[]> {
  const base = new URL(baseUrl);
  const out: Record<string, Set<string>> = {};
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const href = /\bhref=["']([^"']+)["']/i.exec(m[1])?.[1];
    if (!href) continue;
    const hit = watchPageOf(href, base);
    if (!hit) continue;
    const label = decodeEntities(
      m[2].replace(/<img[^>]*\balt=["']([^"']*)["'][^>]*>/gi, " $1 ").replace(/<[^>]+>/g, " ")
    );
    if (LINK_TEXT_OTHER[hit.key]?.test(label)) continue;
    (out[hit.key] ??= new Set()).add(hit.url);
  }
  return Object.fromEntries(Object.entries(out).map(([k, s]) => [k, [...s]]));
}

export function htmlToText(html: string): string {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ");
  // 画像の代替文字（配信サービスのロゴに名前が入っていることが多い）を残す
  s = s.replace(/<img[^>]*\balt=["']([^"']+)["'][^>]*>/gi, " $1 ");
  // 文字の無いリンク（ロゴ画像だけ）が配信サービスを指していれば、行き先からサービス名を補う。
  // リンクに文字があるとき（例：「dアニメストア for Prime Video」→ Amazon）は、その文字を優先して何も足さない
  s = s.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (all, attrs: string, inner: string) => {
    const href = /\bhref=["']([^"']+)["']/i.exec(attrs)?.[1];
    if (!href) return all;
    const innerText = inner.replace(/<[^>]+>/g, " ").replace(/&nbsp;|\s/g, "");
    if (innerText) return all;
    const name = serviceNameOfUrl(href);
    return name ? `${all} ${name} ` : all;
  });
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
  const info: { status?: number } = {};
  try {
    first = await fetchHtml(top.href, info);
  } catch {
    first = null;
  }
  if (!first) {
    // 403/401/429 はサイト側が自動の読み取りを断っている。名乗りを偽って読みに行くことはしない（人がブラウザで確認する）
    if (info.status === 401 || info.status === 403 || info.status === 429) {
      return { status: "blocked", pages: [], reason: `サイトが自動の読み取りを断っています（HTTP ${info.status}）。手作業で確認してください` };
    }
    return { status: "unreachable", pages: [], reason: "公式サイトを開けませんでした" };
  }

  const pages: OfficialPage[] = [];
  const topText = relevantText(htmlToText(first.html));
  if (topText) pages.push({ url: first.finalUrl, text: topText, links: serviceWatchLinks(first.html, first.finalUrl) });

  for (const sub of findSubpages(first.html, new URL(first.finalUrl))) {
    const u = new URL(sub);
    if (!isSafePublicUrl(u.href) || !(await robotsAllows(u))) continue;
    try {
      const r = await fetchHtml(u.href);
      if (!r) continue;
      const t = relevantText(htmlToText(r.html));
      if (t) pages.push({ url: r.finalUrl, text: t, links: serviceWatchLinks(r.html, r.finalUrl) });
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
