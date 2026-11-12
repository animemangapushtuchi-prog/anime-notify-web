// 台帳（2027-winter.evidence.json）の根拠が、scan.mjs で保存した公式ページの本文に本当にあるかを確かめてから書き出す。
//   node scripts/upcoming/build.mjs
// 1行でも根拠が見つからなければ、何も書かずにエラーで止まる。
// 書き出すもの：content/upcoming/2027-winter.json（放送予定）と scripts/upcoming/out/2027-winter.rows.json（配信の行）
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SEASON, CACHE_DIR, CHECKED_DIR, CONTENT, OUT_DIR, readJson, readLedger, findEvidence, pagesOf, todayJst } from "./common.mjs";

const SERVICE_KEYS = new Set([
  "d-anime", "abema", "netflix", "prime-video", "u-next", "hulu", "fod", "dmm-tv",
  "lemino", "telasa", "disney-plus", "niconico", "bandai-channel", "anime-times",
]);
const AVAILABILITY = new Set(["included", "rental", "channel", "free", "unknown"]);

const ledger = readLedger();
if (ledger.season !== SEASON) throw new Error(`台帳の season が ${SEASON} ではありません: ${ledger.season}`);
const media = readJson(join(CACHE_DIR, "anilist.json"), null);
if (!media) throw new Error(`先に node scripts/upcoming/scan.mjs を実行してください（${CACHE_DIR} に本文がありません）`);
const mediaOf = new Map(media.map((m) => [m.id, m]));

const errors = [];
const pagesCache = new Map();
function pagesFor(id) {
  if (!pagesCache.has(id)) pagesCache.set(id, pagesOf(readJson(join(CACHE_DIR, `${id}.json`), null)));
  return pagesCache.get(id);
}

// 行ごとの確認。見つかったページの URL を返す
function check(kind, r, extra) {
  const where = `${kind} id=${r.id}${r.serviceKey ? " " + r.serviceKey : ""}`;
  const problems = [...extra];
  if (!mediaOf.has(r.id)) problems.push("AniList の冬の作品一覧に無い（scan.mjs を実行し直すか、台帳から外す）");
  if (!r.evidence || !String(r.evidence).trim()) problems.push("evidence が空");
  const page = r.evidence ? findEvidence(pagesFor(r.id), r.evidence) : null;
  if (r.evidence && !page) problems.push(`evidence が保存した本文に見つからない：「${r.evidence}」`);
  if (problems.length) errors.push(`${where}：${problems.join("／")}`);
  return page?.url ?? "";
}

// ---- 放送予定 ----
const seen = new Set();
const works = [];
for (const r of ledger.schedule) {
  const p = [];
  if (seen.has(r.id)) p.push("同じ作品が2回ある");
  seen.add(r.id);
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(r.start ?? "")) p.push(`start の形が違う（${r.start}）`);
  if (r.kind !== "tv" && r.kind !== "movie") p.push(`kind は tv か movie（${r.kind}）`);
  if (typeof r.slot !== "string" || typeof r.tv !== "string") p.push("slot と tv は文字列（未発表なら空文字）");
  const sourceUrl = check("放送", r, p);
  const m = mediaOf.get(r.id);
  if (!m || !sourceUrl) continue;
  works.push({
    id: r.id,
    title: m.title.native ?? m.title.romaji,
    cover: m.coverImage?.extraLarge ?? "",
    kind: r.kind,
    start: r.start,
    slot: r.slot,
    tv: r.tv,
    sourceUrl,
  });
}

// ---- 配信 ----
const seenRow = new Set();
const rows = [];
for (const r of ledger.streaming) {
  const p = [];
  const key = `${r.id}_${r.serviceKey}`;
  if (seenRow.has(key)) p.push("同じ作品・サービスが2回ある");
  seenRow.add(key);
  if (!SERVICE_KEYS.has(r.serviceKey)) p.push(`serviceKey が不明（${r.serviceKey}）`);
  if (!AVAILABILITY.has(r.availability)) p.push(`availability が不明（${r.availability}）`);
  if (r.firstDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(r.firstDate)) p.push(`firstDate は YYYY-MM-DD か null（${r.firstDate}）`);
  if (r.weeklyDay != null && !(Number.isInteger(r.weeklyDay) && r.weeklyDay >= 0 && r.weeklyDay <= 6)) p.push(`weeklyDay は 0〜6 か null（${r.weeklyDay}）`);
  if (r.weeklyTime != null && !/^\d{1,2}:\d{2}$/.test(r.weeklyTime)) p.push(`weeklyTime は "26:30" の形か null（${r.weeklyTime}）`);
  if (r.watchUrl && !/^https:\/\//.test(r.watchUrl)) p.push("watchUrl は https:// で始まるURLか空文字");
  if (String(r.evidence ?? "").length > 120) p.push("evidence が長すぎる（1文まで）");
  const sourceUrl = check("配信", r, p);
  const m = mediaOf.get(r.id);
  if (!m || !sourceUrl) continue;
  rows.push({
    anilistId: r.id,
    title: m.title.native ?? m.title.romaji,
    coverImage: m.coverImage?.extraLarge ?? "",
    serviceKey: r.serviceKey,
    availability: r.availability,
    firstAvailableAt: r.firstDate ?? null,
    weeklyDay: r.weeklyDay ?? null,
    weeklyTime: r.weeklyTime ?? null,
    isExclusive: !!r.isExclusive,
    isFastest: !!r.isFastest,
    sourceUrl,
    sourceLabel: `公式サイト：「${String(r.evidence).trim()}」`,
    watchUrl: r.watchUrl ?? "",
  });
}

if (errors.length) {
  console.error(`根拠を確かめられない行が ${errors.length} 件あります。何も書き出していません。\n`);
  for (const e of errors) console.error("  × " + e);
  console.error("\n公式ページの文が変わった可能性があります。scan.mjs の出力を見て台帳を直してください。");
  process.exit(1);
}

const today = todayJst();
works.sort((a, b) => a.start.localeCompare(b.start) || a.id - b.id);
writeFileSync(CONTENT, JSON.stringify({ season: SEASON, checkedAt: today, works }, null, 1) + "\n");
mkdirSync(OUT_DIR, { recursive: true });
const rowsPath = join(OUT_DIR, `${SEASON}.rows.json`);
writeFileSync(rowsPath, JSON.stringify({ season: SEASON, note: `${today} 公式サイトで確認`, rows }, null, 1) + "\n");

const dated = works.filter((w) => /^\d{4}-\d{2}-\d{2}$/.test(w.start)).length;
console.log(`OK：放送予定 ${works.length}作品（日付まで決まった作品 ${dated}）→ ${CONTENT}`);
// 根拠を確かめ終えた本文を写しておく（次回、diff.mjs が「前回から変わった作品」を出すのに使う）
rmSync(CHECKED_DIR, { recursive: true, force: true });
cpSync(CACHE_DIR, CHECKED_DIR, { recursive: true });

console.log(`OK：配信 ${rows.length}行・${new Set(rows.map((r) => r.anilistId)).size}作品 → ${rowsPath}`);
