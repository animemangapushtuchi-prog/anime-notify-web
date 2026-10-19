// 公開中の2026年秋の作品について、公式サイトに載っている「配信サービスの作品ページ」へのリンクを集める（書き込みはしない）。
// 結果は watch_fall.json に保存。作品ごとに、サービス→URL（1つに決まったものだけ）と、決まらなかった理由を残す。
import { writeFileSync } from "node:fs";
const LIB = "file:///C:/Users/numas/dev/anime-notify-web/lib/";
const { collectOfficialPages } = await import(LIB + "officialSite.ts");

const BASE = "https://firestore.googleapis.com/v1/projects/anime-notify-app-86ccc/databases/(default)/documents";
const meta = await (await fetch(`${BASE}/seasonStreamingPublic/2026-fall`)).json();
const rows = meta.fields.entries.arrayValue.values.map((v) => {
  const f = v.mapValue.fields;
  return { id: Number(f.anilistId.integerValue), t: f.title.stringValue, svc: f.serviceKey.stringValue, src: f.sourceUrl?.stringValue || "" };
});
const ids = [...new Set(rows.map((r) => r.id))];

// AniList の公式サイトURL
const Q = `query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids) { id externalLinks { site url } } } }`;
const official = {};
for (let i = 0; i < ids.length; i += 50) {
  const j = await (await fetch("https://graphql.anilist.co", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: Q, variables: { ids: ids.slice(i, i + 50) } }) })).json();
  for (const m of j.data.Page.media) official[m.id] = (m.externalLinks || []).filter((l) => /official\s*site/i.test(l.site)).map((l) => l.url);
}

const out = [];
let next = 0;
async function worker() {
  while (next < ids.length) {
    const id = ids[next++];
    const mine = rows.filter((r) => r.id === id);
    // 公式サイトのトップ（日本語のもの優先）と、出典として記録している放送・配信ページの両方を読む
    const starts = [...new Set([...(official[id] || []).filter((u) => !/\/en\/?$|global/i.test(u)).slice(0, 1), ...mine.map((r) => r.src).filter((u) => /^https?:/.test(u))])].slice(0, 3);
    const links = {};
    const status = [];
    for (const u of starts) {
      try {
        const r = await collectOfficialPages(u);
        status.push(r.status);
        for (const p of r.pages) for (const [k, urls] of Object.entries(p.links || {})) for (const x of urls) (links[k] ??= new Set()).add(x);
      } catch (e) {
        status.push("error");
      }
    }
    const watch = {};
    const ambiguous = {};
    for (const r of mine) {
      const s = links[r.svc];
      if (!s) continue;
      if (s.size === 1) watch[r.svc] = [...s][0];
      else ambiguous[r.svc] = [...s];
    }
    out.push({ id, t: mine[0].t, services: mine.map((r) => r.svc), status, watch, ambiguous });
    console.log(`${id} ${mine[0].t.slice(0, 20)}：${Object.keys(watch).length}/${mine.length}社 ${Object.keys(ambiguous).length ? "（候補が複数：" + Object.keys(ambiguous).join(",") + "）" : ""} [${status.join(",")}]`);
  }
}
await Promise.all([worker(), worker()]);
writeFileSync("watch_fall.json", JSON.stringify(out, null, 1));
const total = out.reduce((n, w) => n + w.services.length, 0);
const got = out.reduce((n, w) => n + Object.keys(w.watch).length, 0);
console.log(`\n作品ページのリンクが付く行：${got} / ${total}行（${out.filter((w) => Object.keys(w.watch).length).length}作品）`);
