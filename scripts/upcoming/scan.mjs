// 2027年冬アニメの公式サイトを読み、放送・配信に関する行を表示する（書き込むのは一時フォルダだけ）。
//   node scripts/upcoming/scan.mjs             … 全作品
//   node scripts/upcoming/scan.mjs 214049 ...  … 指定した作品だけ読み直す
// 公式サイトの読み取りは lib/officialSite.ts の collectOfficialPages をそのまま使う（robots.txt 準拠・AnimiruBot を名乗る）。
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SEASON, CACHE_DIR, CONTENT, readJson, readLedger, findEvidence, pagesOf } from "./common.mjs";

const { collectOfficialPages } = await import(new URL("../../lib/officialSite.ts", import.meta.url).href);
const { extractStreaming } = await import(new URL("../../lib/extractStreaming.ts", import.meta.url).href);

const onlyIds = process.argv.slice(2).map(Number).filter(Boolean);
const CONCURRENCY = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- AniList（429 なら待ってやり直す） ----
const QUERY = `query ($page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(season: WINTER, seasonYear: 2027, type: ANIME, isAdult: false, sort: POPULARITY_DESC) {
      id format title { native romaji } coverImage { extraLarge }
      startDate { year month day } externalLinks { site url language }
    }
  }
}`;

async function anilist(variables) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: QUERY, variables }),
    });
    if (res.status === 429 || res.status >= 500) {
      const wait = (Number(res.headers.get("retry-after")) || 30) * 1000;
      console.error(`AniList ${res.status}。${wait / 1000}秒待ってやり直します`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
    return (await res.json()).data;
  }
  throw new Error("AniList が応答しません");
}

const media = [];
for (let page = 1; ; page++) {
  const d = await anilist({ page });
  media.push(...d.Page.media);
  if (!d.Page.pageInfo.hasNextPage) break;
}
mkdirSync(CACHE_DIR, { recursive: true });
writeFileSync(join(CACHE_DIR, "anilist.json"), JSON.stringify(media, null, 1));

// ---- 台帳 ----
const ledger = readLedger();
const content = readJson(CONTENT, { works: [] });
const scheduleOf = new Map(ledger.schedule.map((r) => [r.id, r]));
const streamingOf = (id) => ledger.streaming.filter((r) => r.id === id);
const skipOf = new Map(ledger.skip.map((r) => [r.id, r]));

function officialUrls(m) {
  const sites = (m.externalLinks ?? []).filter((l) => /official\s*site/i.test(l.site) && !/\/en\/?$|global/i.test(l.url));
  sites.sort((a, b) => (a.language === "Japanese" ? 0 : 1) - (b.language === "Japanese" ? 0 : 1));
  return sites.map((l) => l.url);
}

// 公式サイトのトップ1つ＋台帳の url 欄や前回の出典に記録したページ（同じ公式サイトの放送ページなど）
function startUrls(m) {
  const extra = [
    ...ledger.schedule.filter((r) => r.id === m.id).map((r) => r.url),
    ...ledger.streaming.filter((r) => r.id === m.id).map((r) => r.url),
    ...content.works.filter((w) => w.id === m.id).map((w) => w.sourceUrl),
  ].filter((u) => typeof u === "string" && /^https?:\/\//.test(u));
  return [...new Set([...officialUrls(m).slice(0, 1), ...extra])].slice(0, 3);
}

const WATCH =
  /2027|1月|１月|放送|配信|独占|最速|上映|公開|Prime\s*Video|プライム|Netflix|U-?NEXT|dアニメ|ABEMA|Hulu|DMM|Lemino|FOD|TELASA|Disney|ディズニー|ニコニコ|niconico|バンダイチャンネル|アニメタイムズ/i;
const MAX_LINES = 30;

async function scanOne(m) {
  const results = [];
  for (const u of startUrls(m)) {
    try {
      const r = await collectOfficialPages(u);
      results.push({ start: u, status: r.status, reason: r.reason ?? "", pages: r.pages });
    } catch (e) {
      results.push({ start: u, status: "error", reason: String(e?.message ?? e), pages: [] });
    }
  }
  const saved = { id: m.id, title: m.title.native ?? m.title.romaji, fetchedAt: new Date().toISOString(), results };
  writeFileSync(join(CACHE_DIR, `${m.id}.json`), JSON.stringify(saved, null, 1));
  return saved;
}

function report(m, saved) {
  const pages = pagesOf(saved);
  const title = m.title.native ?? m.title.romaji;
  const inLedger = scheduleOf.has(m.id) || streamingOf(m.id).length > 0 || skipOf.has(m.id);
  const sch = scheduleOf.get(m.id);
  const ledgerRows = [
    ...(sch ? [{ label: `放送 ${sch.start} ${sch.slot} ${sch.tv}`, ev: sch.evidence }] : []),
    ...streamingOf(m.id).map((r) => ({ label: `配信 ${r.serviceKey}`, ev: r.evidence })),
  ];
  const lost = ledgerRows.filter((r) => !findEvidence(pages, r.ev));
  const marks = [];
  if (!inLedger) marks.push("【新】台帳に無い");
  if (lost.length) marks.push("【消】根拠が本文に無い");

  const out = [`\n==== ${m.id} ${title} [${m.format ?? "?"}] ${marks.join(" ")}`];
  if (!saved.results.length) out.push("  読込: 公式サイトの登録なし（AniList）");
  for (const r of saved.results) out.push(`  読込: ${r.status} ${r.start}${r.reason ? "（" + r.reason + "）" : ""}`);
  if (skipOf.has(m.id)) out.push(`  台帳skip: ${skipOf.get(m.id).reason}`);
  for (const r of ledgerRows) out.push(`  台帳 ${lost.includes(r) ? "×" : "○"} ${r.label}｜「${r.ev}」`);

  const lines = [];
  const seen = new Set();
  for (const p of pages) {
    for (const l of p.text.split("\n")) {
      if (!WATCH.test(l) || seen.has(l)) continue;
      seen.add(l);
      lines.push(l.length > 160 ? l.slice(0, 160) + "…" : l);
    }
  }
  for (const l of lines.slice(0, MAX_LINES)) out.push(`  | ${l}`);
  if (lines.length > MAX_LINES) out.push(`  | …ほか${lines.length - MAX_LINES}行`);

  const ex = extractStreaming({ anilistId: m.id, title, season: { year: 2027, season: "winter" }, pages });
  for (const r of ex.rows) {
    const d = r.firstAvailableAt ? new Date(r.firstAvailableAt * 1000 + 9 * 3600e3).toISOString().slice(0, 10) : "";
    const flags = `${r.isExclusive ? " 独占" : ""}${r.isFastest ? " 最速" : ""}`;
    out.push(`  候補 ${r.serviceKey} ${d} ${r.weeklyDay ?? ""} ${r.weeklyTime ?? ""}${flags}｜${r.sourceLabel}`);
  }
  if (ex.excluded) out.push(`  （前シーズン等として除外した行: ${ex.excluded}）`);
  return { text: out.join("\n"), isNew: !inLedger, lost: lost.length > 0, ok: saved.results.some((r) => r.status === "ok") };
}

const targets = media.filter((m) => !onlyIds.length || onlyIds.includes(m.id));
console.log(`${SEASON}: AniList ${media.length}作品。読む作品 ${targets.length}（本文の保存先 ${CACHE_DIR}）`);
const reports = new Map();
let next = 0;
async function worker() {
  while (next < targets.length) {
    const m = targets[next++];
    reports.set(m.id, report(m, await scanOne(m)));
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

for (const m of targets) console.log(reports.get(m.id).text);
const list = (f) => targets.filter((m) => f(reports.get(m.id))).map((m) => `${m.id} ${m.title.native ?? m.title.romaji}`);
const section = (label, items) => console.log(`${label}（${items.length}）:${items.map((s) => "\n  " + s).join("")}`);
console.log("\n---- まとめ ----");
section("台帳に無い作品", list((r) => r.isNew));
section("根拠が本文から消えた作品", list((r) => r.lost));
section("本文が読めなかった作品", list((r) => !r.ok));
