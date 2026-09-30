// 公式サイトの文章から配信情報を抜き出すルール（lib/extractStreaming.ts）の確認テスト。
// 実行: npm test
//
// ここにある文は、2026年秋アニメの公式サイトで実際に読み間違えた「形」を短く作り直したもの
// （公式サイトの文章そのものは転載していない）。ルールを直したら必ずこのテストを通すこと。
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractStreaming, seasonNumberOf } from "../lib/extractStreaming.ts";

const FALL = { year: 2026, season: "fall" };
const jst = (y, m, d) =>
  Math.floor(new Date(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T00:00:00+09:00`).getTime() / 1000);

// 文章を1ページとして読ませ、サービスごとの行を返す
function run(text, { title = "テスト作品", season = FALL } = {}) {
  const r = extractStreaming({
    anilistId: 1,
    title,
    season,
    pages: [{ url: "https://example.com/onair", text }],
  });
  return { excluded: r.excluded, by: Object.fromEntries(r.rows.map((x) => [x.serviceKey, x])) };
}

test("複数サービスが並ぶ行は、サービス名だけ取り日付は付けない", () => {
  const { by } = run("10月3日(土)より Prime Video、U-NEXT、dアニメストアほかで配信");
  assert.deepEqual(Object.keys(by).sort(), ["d-anime", "prime-video", "u-next"]);
  for (const r of Object.values(by)) {
    assert.equal(r.firstAvailableAt, null);
    assert.equal(r.weeklyDay, null);
    assert.equal(r.availability, "unknown");
  }
});

test("サービスが1つの行は、開始日・曜日・時刻・最速を読む", () => {
  const { by } = run("ABEMAにて10月3日(土)24時00分より毎週土曜 最速配信");
  assert.equal(by.abema.firstAvailableAt, jst(2026, 10, 3));
  assert.equal(by.abema.weeklyDay, 6);
  assert.equal(by.abema.weeklyTime, "24:00");
  assert.equal(by.abema.isFastest, true);
  assert.equal(by.abema.isExclusive, false);
});

test("「10/3(土)」形式の日付も読む", () => {
  const { by } = run("Leminoにて10/3(土)より配信");
  assert.equal(by.lemino.firstAvailableAt, jst(2026, 10, 3));
});

test("曜日は「毎週」と書かれているときだけ", () => {
  const { by } = run("U-NEXTにて10月4日(日)より配信");
  assert.equal(by["u-next"].firstAvailableAt, jst(2026, 10, 4));
  assert.equal(by["u-next"].weeklyDay, null);
});

test("「木曜深夜0時30分」は 木曜 24:30 として読む", () => {
  const { by } = run("dアニメストアにて毎週木曜深夜0時30分より配信");
  assert.equal(by["d-anime"].weeklyDay, 4);
  assert.equal(by["d-anime"].weeklyTime, "24:30");
  assert.equal(by["d-anime"].firstAvailableAt, null);
});

test("サービス名の次の行にある日時を読む（表の並び）", () => {
  const { by } = run("U-NEXT\n10月4日(日)22:00〜 毎週日曜更新");
  assert.equal(by["u-next"].firstAvailableAt, jst(2026, 10, 4));
  assert.equal(by["u-next"].weeklyDay, 0);
  assert.equal(by["u-next"].weeklyTime, "22:00");
});

test("「dアニメストア for Prime Video」は Prime Video 本体として数えない", () => {
  const { by } = run("dアニメストア for Prime Videoで配信");
  assert.deepEqual(Object.keys(by), ["d-anime"]);
});

test("特番・PV・YouTube などの行は使わない", () => {
  for (const line of [
    "ABEMAで放送直前特番を配信 9月27日(日)",
    "Netflixにて第1弾PVを公開",
    "ABEMAにて前シリーズを一挙配信",
  ]) {
    const { by, excluded } = run(line);
    assert.deepEqual(Object.keys(by), [], line);
    assert.equal(excluded, 1, line);
  }
});

test("お知らせ欄の掲載日（行の先頭）は開始日にしない", () => {
  const { by } = run("2026.09.28 U-NEXTで配信決定");
  assert.equal(by["u-next"].firstAvailableAt, null);
});

test("お知らせ欄の掲載日（次の行）は開始日にしない", () => {
  const { by } = run("Prime Videoでの配信が決定!\n2026.09.18");
  assert.equal(by["prime-video"].firstAvailableAt, null);
});

test("「〜まで」の終了日は開始日にしない", () => {
  const { by } = run("Netflixにて12月31日(木)23時59分まで配信");
  assert.equal(by.netflix.firstAvailableAt, null);
  assert.equal(by.netflix.weeklyTime, null);
});

test("前のシーズンの案内は使わない", () => {
  const { by, excluded } = run("第1期・第2期はU-NEXTで好評配信中", { title: "テスト作品 第3期" });
  assert.deepEqual(Object.keys(by), []);
  assert.equal(excluded, 1);
});

test("対象の期が書かれた行は使う", () => {
  const { by } = run("第3期はU-NEXTにて10月4日(日)より配信", { title: "テスト作品 第3期" });
  assert.equal(by["u-next"].firstAvailableAt, jst(2026, 10, 4));
});

test("シーズン期間から外れた日付の行は使わない", () => {
  const { by, excluded } = run("Huluにて2025年10月5日より配信");
  assert.deepEqual(Object.keys(by), []);
  assert.equal(excluded, 1);
});

test("冬アニメの12月の先行配信は前年の日付として読む", () => {
  const { by } = run("ABEMAにて12月28日(月)より配信", { season: { year: 2027, season: "winter" } });
  assert.equal(by.abema.firstAvailableAt, jst(2026, 12, 28));
});

test("見放題・レンタル・独占を読む。「無料体験」は無料配信ではない", () => {
  assert.equal(run("dアニメストアで見放題配信").by["d-anime"].availability, "included");
  assert.equal(run("Prime Videoでレンタル配信").by["prime-video"].availability, "rental");
  assert.equal(run("U-NEXT 31日間無料体験").by["u-next"].availability, "unknown");
  assert.equal(run("Netflixにて独占配信").by.netflix.isExclusive, true);
});

test("同じサービスが複数回出るときは、情報が多い行を採用する", () => {
  const { by } = run("ABEMA、U-NEXTで配信\nABEMAにて10月3日(土)より配信");
  assert.equal(by.abema.firstAvailableAt, jst(2026, 10, 3));
  assert.equal(by["u-next"].firstAvailableAt, null);
});

test("根拠の文と出典URLが付く", () => {
  const { by } = run("Netflixにて独占配信");
  assert.equal(by.netflix.sourceUrl, "https://example.com/onair");
  assert.equal(by.netflix.sourceLabel, "公式サイト：「Netflixにて独占配信」");
  assert.equal(by.netflix.sourceType, "official-site");
});

test("タイトルから何期目かを読む", () => {
  assert.equal(seasonNumberOf("テスト作品"), 1);
  assert.equal(seasonNumberOf("テスト作品 第3期"), 3);
  assert.equal(seasonNumberOf("テスト作品 Season 2"), 2);
  assert.equal(seasonNumberOf("テスト作品 2nd Season"), 2);
  assert.equal(seasonNumberOf("片田舎のおっさん、剣聖になるII"), 2);
  assert.equal(seasonNumberOf("テスト作品Ⅲ"), 3);
});
