/* eslint-disable @typescript-eslint/no-require-imports */
// 確かめた作品ページのリンク（watch_verify.json の ok と unknown）を、2026年秋の配信行に書き込み、公開まとめ文書を作り直す。
// 使い方: node apply_watch.js [--write]
const path = require("path");
const fs = require("fs");
const FT = path.join(process.env.APPDATA, "npm/node_modules/firebase-tools/lib");
const { configstore } = require(path.join(FT, "configstore"));
const auth = require(path.join(FT, "auth"));

const SEASON = "2026-fall";
const PROJECT = "projects/anime-notify-app-86ccc/databases/(default)/documents";
const BASE = `https://firestore.googleapis.com/v1/${PROJECT}`;
const WRITE = process.argv.includes("--write");
const extra = process.argv.find((a) => a.endsWith(".json") && a !== "watch_verify.json");

let items = JSON.parse(fs.readFileSync("watch_verify.json", "utf8")).filter((r) => r.verdict !== "mismatch");
// 手で確認したリンク（例：自動読み取りを断っているサイト）を追加するとき：node apply_watch.js extra.json
if (extra) items = items.concat(JSON.parse(fs.readFileSync(extra, "utf8")));

const val = (v) => (v === null || v === undefined ? { nullValue: null } : typeof v === "boolean" ? { booleanValue: v } : typeof v === "number" ? { integerValue: String(v) } : { stringValue: String(v) });
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)]));
let token;
async function api(method, url, body) {
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json();
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

(async () => {
  console.log(`${items.length}行に作品ページのリンクを付ける（${new Set(items.map((i) => i.id)).size}作品）`);
  if (!WRITE) return console.log("確認のみ。書き込むときは --write");
  token = (await auth.getAccessToken(configstore.get("tokens").refresh_token, [])).access_token;

  // 管理用・公開用の行に watchUrl だけを書く（ほかの項目は変えない）。行が無いもの（未公開）は飛ばす
  const writes = [];
  for (const it of items) {
    const id = `${it.id}_${it.svc}`;
    for (const col of ["seasonStreamingAdmin", "seasonStreamingPublic"]) {
      writes.push({
        update: { name: `${PROJECT}/${col}/${SEASON}/entries/${id}`, fields: { watchUrl: val(it.url) } },
        updateMask: { fieldPaths: ["watchUrl"] },
        currentDocument: { exists: true },
      });
    }
  }
  for (let i = 0; i < writes.length; i += 400) await api("POST", `${BASE}:commit`, { writes: writes.slice(i, i + 400) });
  console.log(`書き込み ${writes.length}件`);

  // 公開まとめ文書を作り直す（lib/seasonAdmin.ts の refreshSeasonMeta と同じ形。watchUrl を含む）
  const all = [];
  let pageToken = "";
  do {
    const j = await api("GET", `${BASE}/seasonStreamingPublic/${SEASON}/entries?pageSize=300${pageToken ? "&pageToken=" + pageToken : ""}`);
    all.push(...(j.documents || []));
    pageToken = j.nextPageToken || "";
  } while (pageToken);
  const str = (f, k) => f[k]?.stringValue ?? null;
  const num = (f, k) => (f[k]?.integerValue != null ? Number(f[k].integerValue) : f[k]?.doubleValue ?? (f[k]?.timestampValue ? Math.floor(Date.parse(f[k].timestampValue) / 1000) : null));
  const packed = all.map((d) => {
    const f = d.fields;
    return { mapValue: { fields: fields({
      id: d.name.split("/").pop(), anilistId: num(f, "anilistId"), title: str(f, "title") ?? "", coverImage: str(f, "coverImage") ?? "",
      serviceKey: str(f, "serviceKey"), serviceName: str(f, "serviceName") ?? "", availability: str(f, "availability") ?? "unknown",
      firstAvailableAt: num(f, "firstAvailableAt"), weeklyDay: f.weeklyDay?.integerValue != null ? Number(f.weeklyDay.integerValue) : null,
      weeklyTime: str(f, "weeklyTime"), isExclusive: f.isExclusive?.booleanValue === true, isFastest: f.isFastest?.booleanValue === true,
      sourceUrl: str(f, "sourceUrl") ?? "", sourceCheckedAt: num(f, "sourceCheckedAt"), watchUrl: str(f, "watchUrl") ?? "",
    }) } };
  });
  // 最終確認日（lastPublishedAt）はリンクの追加だけなので動かさない
  const mask = ["entries", "confirmedCount", "entriesPackedAt", "updatedAt"].map((k) => "updateMask.fieldPaths=" + k).join("&");
  const nowTs = { timestampValue: new Date().toISOString() };
  await api("PATCH", `${BASE}/seasonStreamingPublic/${SEASON}?${mask}`, {
    fields: { entries: { arrayValue: { values: packed } }, confirmedCount: val(all.length), entriesPackedAt: nowTs, updatedAt: nowTs },
  });
  console.log(`まとめ文書を更新：${all.length}行（作品ページのリンクあり ${packed.filter((p) => p.mapValue.fields.watchUrl.stringValue).length}行）`);
})().catch((e) => { console.error(e.message); process.exit(1); });
