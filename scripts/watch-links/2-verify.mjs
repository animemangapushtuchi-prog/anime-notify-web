// 集めた作品ページのリンク先を1件ずつ開き、ページのタイトルに作品名が含まれるかを確かめる（書き込みはしない）。
// ・作品名が含まれる → ok
// ・タイトルが取れない（画面をJSで描くサイト等）→ unknown（公式サイトに載っていたリンクなので使う）
// ・タイトルは取れたが作品名が無い → mismatch（使わない。目で確認する）
import { readFileSync, writeFileSync } from "node:fs";
const LIB = "file:///C:/Users/numas/dev/anime-notify-web/lib/";
const { CRAWLER_UA } = await import(LIB + "officialSite.ts");
const data = JSON.parse(readFileSync("watch_fall.json", "utf8"));

const norm = (s) => s.normalize("NFKC").toLowerCase().replace(/[\s\-‐ー－―〜～~・･:：!！?？、。,.「」『』()（）\[\]【】]/g, "");
// 作品名の「核」になる部分（副題・期数を落とした先頭部分）
const core = (t) => {
  const n = norm(t.replace(/(第\s*\d+\s*期|season\s*\d+|\d+(st|nd|rd|th)\s*season|第\s*\d+\s*クール|[ⅡⅢⅣ]|II+|\(\d{4}\)).*$/i, ""));
  return n.slice(0, Math.min(n.length, 8));
};
const items = data.flatMap((w) => Object.entries(w.watch).map(([svc, url]) => ({ id: w.id, t: w.t, svc, url })));
let i = 0;
const results = [];
async function worker() {
  while (i < items.length) {
    const it = items[i++];
    let title = "";
    try {
      const res = await fetch(it.url, { headers: { "User-Agent": CRAWLER_UA, Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(12000) });
      const html = res.ok ? (await res.text()).slice(0, 300000) : "";
      title = (/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] || /property=["']og:title["'][^>]*content=["']([^"']+)/i.exec(html)?.[1] || "").trim();
    } catch { /* 取れない */ }
    const c = core(it.t);
    const verdict = !title || /^(ABEMA|U-NEXT|Netflix|Hulu|FOD|Lemino|TELASA|DMM TV|Disney\+|dアニメストア|Amazon|Prime Video|ニコニコ|バンダイチャンネル)[^a-z]*$/i.test(title)
      ? "unknown"
      : c && norm(title).includes(c) ? "ok" : "mismatch";
    results.push({ ...it, title: title.slice(0, 80), verdict });
    await new Promise((r) => setTimeout(r, 300));
  }
}
await Promise.all([worker(), worker(), worker()]);
writeFileSync("watch_verify.json", JSON.stringify(results, null, 1));
const by = (v) => results.filter((r) => r.verdict === v);
console.log(`ok ${by("ok").length} / unknown ${by("unknown").length} / mismatch ${by("mismatch").length}`);
for (const r of by("mismatch")) console.log("MISMATCH", r.id, r.t.slice(0, 18), r.svc, r.url, "→", r.title);
const unk = {};
for (const r of by("unknown")) unk[r.svc] = (unk[r.svc] || 0) + 1;
console.log("unknown by service", JSON.stringify(unk));
