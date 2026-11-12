// アクセス数・登録者の集計（Firestore の cache/stats と statsDaily）を読んで表示する。読み取りだけ。
// 管理画面 /admin と同じ数字を、手元でまとめて見るための道具。Firebase CLI のログイン（animemangapushtuchi）を使う。
// 使い方: node scripts/read-stats.js [日数（既定 30）]
/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const FT = path.join(process.env.APPDATA, "npm/node_modules/firebase-tools/lib");
const { configstore } = require(path.join(FT, "configstore"));
const auth = require(path.join(FT, "auth"));
const BASE = "https://firestore.googleapis.com/v1/projects/anime-notify-app-86ccc/databases/(default)/documents";
const N = Number(process.argv[2]) || 30;

const dec = (v) => {
  if (v == null) return null;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)]));
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(dec);
  return null;
};
const pairs = (o) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" ");

(async () => {
  const token = (await auth.getAccessToken(configstore.get("tokens").refresh_token, [])).access_token;
  const get = async (p) => {
    const r = await fetch(`${BASE}/${p}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 404) return null;
    const j = await r.json();
    if (!r.ok) throw new Error(`${p} → ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
    return dec({ mapValue: { fields: j.fields } });
  };
  const s = await get("cache/stats");
  console.log(`集計 ${s.updatedAt}｜アカウント ${s.users}｜登録作品 ${s.registrations}（平均 ${s.avgReg}）｜通知の端末 ${s.tokens}｜アンケート ${s.survey?.count ?? 0}`);

  const days = Object.keys(s.pv || {}).sort().slice(-N);
  console.log("\n日付        PV  UV 読んだ(初/再) | 検索から | 行動 | ページの種類");
  for (const d of days) {
    const h = s.human?.[d] || {};
    const f = s.refs?.[d] || {};
    const search = (f.google || 0) + (f.yahoo || 0) + (f.bing || 0);
    console.log(
      d, String(s.pv[d]).padStart(4), String(s.uv?.[d] ?? "-").padStart(3),
      `${String((h.new || 0) + (h.back || 0)).padStart(4)}(${h.new || 0}/${h.back || 0})`.padEnd(13),
      "|", String(search).padStart(3), "|", pairs(s.events?.[d]) || "-", "|", pairs(s.pages?.[d])
    );
  }

  // 直近7日と、その前の7日を比べる
  const sum = (list, f) => list.reduce((n, d) => n + f(d), 0);
  const searchOf = (d) => (s.refs?.[d]?.google || 0) + (s.refs?.[d]?.yahoo || 0) + (s.refs?.[d]?.bing || 0);
  const full = days.slice(0, -1); // 今日は途中なので外す
  for (const [name, list] of [["前の7日", full.slice(-14, -7)], ["直近7日", full.slice(-7)]]) {
    if (!list.length) continue;
    const per = (f) => (sum(list, f) / list.length).toFixed(1);
    console.log(`\n${name}（${list[0]}〜${list[list.length - 1]}）1日あたり：UV ${per((d) => s.uv?.[d] || 0)}｜検索から ${per(searchOf)}｜読んだ訪問 ${per((d) => (s.human?.[d]?.new || 0) + (s.human?.[d]?.back || 0))}｜うち再訪 ${per((d) => s.human?.[d]?.back || 0)}`);
  }

  // ページごとの数（2026-11-12〜）
  const tot = { land: {}, paths: {}, out: {} };
  for (const d of days.slice(-7)) {
    const x = await get(`statsDaily/${d}`);
    for (const k of Object.keys(tot)) for (const [p, v] of Object.entries(x?.[k] || {})) tot[k][p] = (tot[k][p] || 0) + v;
  }
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `  ${String(v).padStart(4)} /${k === "top" ? "" : k.split(":").join("/")}`).join("\n");
  console.log("\n検索から来た人が最初に開いたページ（過去7日）\n" + (top(tot.land, 20) || "  まだデータなし"));
  console.log("\nよく見られたページ（過去7日）\n" + (top(tot.paths, 20) || "  まだデータなし"));
  console.log("\n配信サービスへの移動が多かったページ（過去7日）\n" + (top(tot.out, 10) || "  まだデータなし"));
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
