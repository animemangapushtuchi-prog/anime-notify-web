// 公式サイトのHTMLを文字にする処理（lib/officialSite.ts の htmlToText）の確認テスト。
// 2026年秋に、配信サービスをロゴ画像とリンクだけで並べるサイト（薬屋のひとりごと・ドラゴンボール超 ビルスなど）で
// サービスを取りこぼしたため、リンクの行き先からサービス名を補うようにした。その確認。
import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlToText, serviceWatchLinks } from "../lib/officialSite.ts";
import { extractStreaming } from "../lib/extractStreaming.ts";

const services = (html) =>
  extractStreaming({
    anilistId: 1,
    title: "テスト作品",
    season: { year: 2026, season: "fall" },
    pages: [{ url: "https://example.com/onair", text: htmlToText(html) }],
  })
    .rows.map((r) => r.serviceKey)
    .sort();

test("ロゴ画像だけのリンクは、行き先からサービス名を補う", () => {
  const html = `<h3>見放題配信</h3><ul>
    <li><a href="https://abema.tv/video/title/5-87"><img src="img/lg-abema.png" alt=""></a></li>
    <li><a href="https://animestore.docomo.ne.jp/animestore/ci_pc?workId=1"><img src="img/lg-danime.png"></a></li>
    <li><a href="https://www.netflix.com/title/83189605"><img src="img/lg-nf.png"></a></li>
    <li><a href="https://www.amazon.co.jp/gp/video/detail/B0HJF2ZS9K"><img src="img/lg-pv.png"></a></li>
  </ul>`;
  assert.deepEqual(services(html), ["abema", "d-anime", "netflix", "prime-video"]);
});

test("リンクに文字があるときは、その文字を優先する（dアニメストア for Prime Video を Prime Video と読まない）", () => {
  const html = `<li><a href="https://www.amazon.co.jp/gp/video/detail/B0HF7Z8QBH">dアニメストア for Prime Video</a></li>`;
  assert.deepEqual(services(html), ["d-anime"]);
});

test("Amazon の作品ページ以外（チャンネル・物販）は Prime Video とみなさない", () => {
  const html = `<li><a href="https://www.amazon.co.jp/channels/danime"><img src="x.png"></a></li>
    <li><a href="https://www.amazon.co.jp/dp/B0XXXX"><img src="y.png"></a></li>`;
  assert.deepEqual(services(html), []);
});

test("代替文字のある画像は、代替文字を使い行き先からは足さない", () => {
  const text = htmlToText(`<a href="https://video.unext.jp/title/SID1"><img src="u.png" alt="U-NEXT"></a>`);
  assert.equal((text.match(/U-NEXT/g) || []).length, 1);
});

test("配信サービス以外へのリンクや、サイト内リンクには何も足さない", () => {
  const text = htmlToText(`<a href="https://x.com/anime"><img src="x.png"></a><a href="/news/"><img src="n.png"></a>`);
  assert.equal(text, "");
});

// ---- 配信サービスの作品ページへのリンク（serviceWatchLinks）----
test("配信サービスの作品ページへのリンクを集め、追跡用の引数を外す", () => {
  const html = `
    <a href="https://abema.tv/video/title/5-87?utm_source=official"><img src="a.png"></a>
    <a href="https://animestore.docomo.ne.jp/animestore/ci_pc?workId=27000&amp;utm_medium=x"><img src="d.png"></a>
    <a href="https://www.video.unext.jp/title/SID0316457?rid=SID0316457&adid=XXX">U-NEXT</a>
    <a href="https://www.netflix.com/title/83189605">Netflix</a>
    <a href="https://tv.dmm.com/vod/detail/?season=abc123&utm_campaign=y">DMM TV</a>
    <a href="https://www.amazon.co.jp/gp/video/detail/B0HJF2ZS9K/ref=x">Prime Video</a>`;
  assert.deepEqual(serviceWatchLinks(html, "https://example.com/"), {
    abema: ["https://abema.tv/video/title/5-87"],
    "d-anime": ["https://animestore.docomo.ne.jp/animestore/ci_pc?workId=27000"],
    "u-next": ["https://www.video.unext.jp/title/SID0316457"],
    netflix: ["https://www.netflix.com/title/83189605"],
    "dmm-tv": ["https://tv.dmm.com/vod/detail?season=abc123"],
    "prime-video": ["https://www.amazon.co.jp/gp/video/detail/B0HJF2ZS9K/ref=x"],
  });
});

test("サービスのトップページや、作品を表す引数の無いリンクは使わない", () => {
  const html = `<a href="https://abema.tv/">ABEMA</a><a href="https://animestore.docomo.ne.jp/animestore/ci_pc">dアニメ</a>
    <a href="https://www.hulu.jp/">Hulu</a><a href="https://tv.dmm.com/vod/detail/">DMM TV</a>`;
  assert.deepEqual(serviceWatchLinks(html, "https://example.com/"), {});
});

test("「dアニメストア for Prime Video」のリンクは Prime Video の作品ページとして使わない", () => {
  const html = `<a href="https://www.amazon.co.jp/gp/video/detail/B0HF7Z8QBH">dアニメストア for Prime Video</a>`;
  assert.deepEqual(serviceWatchLinks(html, "https://example.com/"), {});
});

test("同じサービスへのリンクが2つあるときは、作品ページを1つに決めない", () => {
  const html = `<p>U-NEXT</p><a href="https://video.unext.jp/title/SID0000001">第1期</a><a href="https://video.unext.jp/title/SID0000002">第2期</a>`;
  const text = htmlToText(html);
  const rows = extractStreaming({
    anilistId: 1, title: "テスト作品 第2期", season: { year: 2026, season: "fall" },
    pages: [{ url: "https://example.com/", text, links: serviceWatchLinks(html, "https://example.com/") }],
  }).rows;
  assert.equal(rows.find((r) => r.serviceKey === "u-next").watchUrl, null);
});

test("リンクが1つに決まるときは、その行に作品ページを付ける", () => {
  const html = `<p>配信：<a href="https://abema.tv/video/title/19-174"><img src="a.png"></a></p>`;
  const rows = extractStreaming({
    anilistId: 1, title: "テスト作品", season: { year: 2026, season: "fall" },
    pages: [{ url: "https://example.com/", text: htmlToText(html), links: serviceWatchLinks(html, "https://example.com/") }],
  }).rows;
  assert.equal(rows.find((r) => r.serviceKey === "abema").watchUrl, "https://abema.tv/video/title/19-174");
});

test("ABEMA のシーズン指定（?s=）は残す", () => {
  const html = `<a href="https://abema.tv/video/title/19-174?s=19-174_s3&eg=19-174_eg0">ABEMA</a>`;
  assert.deepEqual(serviceWatchLinks(html, "https://example.com/"), { abema: ["https://abema.tv/video/title/19-174?s=19-174_s3"] });
});
