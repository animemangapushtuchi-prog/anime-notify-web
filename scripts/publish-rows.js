// 確かめた配信の行を「確認済み＋公開」で書き込み、公開まとめ文書を作り直す。
// 管理画面の保存（lib/seasonAdmin.ts の saveEntries → refreshSeasonMeta）と同じ3か所をそろえる：
//   管理用 seasonStreamingAdmin/{季節}/entries、公開用 seasonStreamingPublic/{季節}/entries、公開まとめ（親文書の entries 配列）
// 管理画面にログインできないとき用。Firebase CLI のログイン（animemangapushtuchi）を使う。
//
// 使い方: node scripts/publish-rows.js rows.json          … 内容の確認だけ
//         node scripts/publish-rows.js rows.json --write  … 書き込む
// rows.json: { "season": "2027-winter" | "catalog", "note": "いつ・何で確かめたか",
//   "rows": [ { anilistId, title, coverImage, serviceKey, availability, firstAvailableAt: "YYYY-MM-DD"|null,
//               weeklyDay, weeklyTime, isExclusive, isFastest, sourceUrl, sourceLabel, watchUrl } ] }
// 出典URL（sourceUrl）の無い行は受け付けない。推測で作った行を入れないこと（docs/HANDOFF.md §3）。
/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const fs = require("fs");
const FT = path.join(process.env.APPDATA, "npm/node_modules/firebase-tools/lib");
const { configstore } = require(path.join(FT, "configstore"));
const auth = require(path.join(FT, "auth"));

const file = process.argv[2];
if (!file) {
  console.log("使い方: node scripts/publish-rows.js rows.json [--write]");
  process.exit(1);
}
const input = JSON.parse(fs.readFileSync(file, "utf8"));
const WRITE = process.argv.includes("--write");
const SEASON = input.season;
if (!/^(catalog|\d{4}-(winter|spring|summer|fall))$/.test(SEASON || "")) throw new Error("season が不正: " + SEASON);
const PROJECT = "projects/anime-notify-app-86ccc/databases/(default)/documents";
const BASE = `https://firestore.googleapis.com/v1/${PROJECT}`;
const NOW = Math.floor(Date.now() / 1000);
const NAMES = {
  "d-anime": "dアニメストア", abema: "ABEMA", netflix: "Netflix", "prime-video": "Prime Video", "u-next": "U-NEXT",
  hulu: "Hulu", fod: "FOD", "dmm-tv": "DMM TV", lemino: "Lemino", telasa: "TELASA", "disney-plus": "Disney+",
  niconico: "ニコニコ", "bandai-channel": "バンダイチャンネル", "anime-times": "アニメタイムズ",
};
const AVAIL = new Set(["included", "rental", "channel", "free", "unknown"]);
const toSec = (d) => (d ? Math.floor(new Date(`${d}T00:00:00+09:00`).getTime() / 1000) : null);

const val = (v) =>
  v === null || v === undefined ? { nullValue: null }
  : typeof v === "boolean" ? { booleanValue: v }
  : typeof v === "number" ? { integerValue: String(v) }
  : { stringValue: String(v) };
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)]));

const rows = input.rows.map((r) => {
  if (!NAMES[r.serviceKey]) throw new Error("不明なサービス " + r.serviceKey);
  if (!Number.isInteger(r.anilistId) || r.anilistId <= 0) throw new Error("anilistId が不正 " + JSON.stringify(r).slice(0, 80));
  if (!/^https?:\/\//.test(r.sourceUrl || "")) throw new Error(`出典URLが無い ${r.anilistId} ${r.serviceKey}`);
  if (r.watchUrl && !/^https:\/\//.test(r.watchUrl)) throw new Error(`watchUrl は https:// で始める ${r.anilistId} ${r.serviceKey}`);
  const availability = r.availability || "unknown";
  if (!AVAIL.has(availability)) throw new Error("availability が不正 " + availability);
  if (r.firstAvailableAt && !/^\d{4}-\d{2}-\d{2}$/.test(r.firstAvailableAt)) throw new Error("firstAvailableAt は YYYY-MM-DD " + r.firstAvailableAt);
  return {
    anilistId: r.anilistId, title: r.title || "", coverImage: r.coverImage || "", serviceKey: r.serviceKey, availability,
    firstAvailableAt: toSec(r.firstAvailableAt), weeklyDay: r.weeklyDay ?? null, weeklyTime: r.weeklyTime ?? null,
    isExclusive: !!r.isExclusive, isFastest: !!r.isFastest, sourceUrl: r.sourceUrl, sourceLabel: r.sourceLabel || "", watchUrl: r.watchUrl || "",
  };
});

let token;
async function api(method, url, body) {
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json();
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

(async () => {
  for (const r of rows) {
    const day = r.firstAvailableAt ? new Date((r.firstAvailableAt + 32400) * 1000).toISOString().slice(0, 10) : "          ";
    console.log(`${r.anilistId} ${r.serviceKey.padEnd(14)} ${r.availability.padEnd(8)} ${day} ${r.weeklyDay ?? "-"} ${r.weeklyTime ?? ""} ${r.isFastest ? "最速" : ""}${r.isExclusive ? "独占" : ""} ${r.title.slice(0, 24)}`);
  }
  console.log(`${SEASON}：${rows.length}行・${new Set(rows.map((r) => r.anilistId)).size}作品`);
  if (!WRITE) return console.log("確認のみ。書き込むときは --write");
  token = (await auth.getAccessToken(configstore.get("tokens").refresh_token, [])).access_token;
  const nowTs = { timestampValue: new Date().toISOString() };

  const writes = [];
  for (const r of rows) {
    const id = `${r.anilistId}_${r.serviceKey}`;
    // 管理用のメモは消さずに追記する
    let note = input.note || "";
    try {
      const cur = await api("GET", `${BASE}/seasonStreamingAdmin/${SEASON}/entries/${id}`);
      const old = cur.fields?.note?.stringValue;
      if (old && old !== note) note = `${old} / ${note}`;
    } catch {
      /* 新しい行 */
    }
    const common = {
      anilistId: r.anilistId, title: r.title, coverImage: r.coverImage, serviceKey: r.serviceKey, serviceName: NAMES[r.serviceKey],
      availability: r.availability, firstAvailableAt: r.firstAvailableAt, weeklyDay: r.weeklyDay, weeklyTime: r.weeklyTime,
      isExclusive: r.isExclusive, isFastest: r.isFastest, sourceUrl: r.sourceUrl, sourceCheckedAt: NOW, watchUrl: r.watchUrl,
    };
    writes.push({ update: { name: `${PROJECT}/seasonStreamingAdmin/${SEASON}/entries/${id}`, fields: {
      ...fields({ ...common, titleNormalized: "", status: "confirmed", episode: null, sourceType: "official", sourceLabel: r.sourceLabel, confidence: "high", note, published: true }),
      updatedAt: nowTs,
    } } });
    writes.push({ update: { name: `${PROJECT}/seasonStreamingPublic/${SEASON}/entries/${id}`, fields: { ...fields(common), updatedAt: nowTs } } });
  }
  for (let i = 0; i < writes.length; i += 400) await api("POST", `${BASE}:commit`, { writes: writes.slice(i, i + 400) });
  console.log(`書き込み ${writes.length}件`);

  // 公開まとめ文書を作り直す（lib/seasonAdmin.ts の refreshSeasonMeta と同じ形）
  const all = [];
  let pageToken = "";
  do {
    const j = await api("GET", `${BASE}/seasonStreamingPublic/${SEASON}/entries?pageSize=300${pageToken ? "&pageToken=" + pageToken : ""}`);
    all.push(...(j.documents || []));
    pageToken = j.nextPageToken || "";
  } while (pageToken);
  const str = (f, k) => f[k]?.stringValue ?? null;
  const num = (f, k) => (f[k]?.integerValue != null ? Number(f[k].integerValue) : f[k]?.doubleValue ?? (f[k]?.timestampValue ? Math.floor(Date.parse(f[k].timestampValue) / 1000) : null));
  const plain = all.map((d) => {
    const f = d.fields;
    return {
      id: d.name.split("/").pop(), anilistId: num(f, "anilistId"), title: str(f, "title") ?? "", coverImage: str(f, "coverImage") ?? "",
      serviceKey: str(f, "serviceKey"), serviceName: str(f, "serviceName") ?? "", availability: str(f, "availability") ?? "unknown",
      firstAvailableAt: num(f, "firstAvailableAt"), weeklyDay: f.weeklyDay?.integerValue != null ? Number(f.weeklyDay.integerValue) : null,
      weeklyTime: str(f, "weeklyTime"), isExclusive: f.isExclusive?.booleanValue === true, isFastest: f.isFastest?.booleanValue === true,
      sourceUrl: str(f, "sourceUrl") ?? "", sourceCheckedAt: num(f, "sourceCheckedAt"), watchUrl: str(f, "watchUrl") ?? "",
    };
  });
  // 1文書は最大1MB。超えそうなら止める（まとめを分ける対応が必要）
  const size = JSON.stringify(plain).length;
  if (size > 900_000) throw new Error(`まとめ文書が大きすぎます（${size}バイト）。行は書き込み済みですが、まとめは更新していません`);
  const parent = { seasonKey: SEASON, confirmedCount: all.length };
  const m = /^(\d{4})-(winter|spring|summer|fall)$/.exec(SEASON);
  if (m) Object.assign(parent, { year: Number(m[1]), season: m[2], label: `${m[1]}年${{ winter: "冬", spring: "春", summer: "夏", fall: "秋" }[m[2]]}アニメ` });
  const keys = [...Object.keys(parent), "entries", "entriesPackedAt", "lastPublishedAt", "updatedAt"];
  await api("PATCH", `${BASE}/seasonStreamingPublic/${SEASON}?${keys.map((k) => "updateMask.fieldPaths=" + k).join("&")}`, {
    fields: {
      ...fields(parent),
      entries: { arrayValue: { values: plain.map((e) => ({ mapValue: { fields: fields(e) } })) } },
      entriesPackedAt: nowTs, lastPublishedAt: nowTs, updatedAt: nowTs,
    },
  });
  console.log(`まとめ文書を更新：公開 ${all.length}行・${new Set(plain.map((e) => e.anilistId)).size}作品（${size}バイト）`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
