// 作品ページの検索結果用の文（lib/workMeta.ts）の確認テスト。
// 「配信予定」の作品を「配信」と言わないこと、社数が実際の行数と一致することを確かめる
import { test } from "node:test";
import assert from "node:assert/strict";
import { whereLine, isUpcoming, orderServices, latestCheckedLabel, jstDateLabel, upcomingWorks } from "../lib/workMeta.ts";

const NOW = 1_800_000_000;
const row = (serviceKey, serviceName, extra = {}) => ({
  serviceKey,
  serviceName,
  firstAvailableAt: null,
  isExclusive: false,
  ...extra,
});

test("1社なら社数を出さない", () => {
  assert.equal(whereLine([row("u-next", "U-NEXT")], "放送終了", NOW), "U-NEXTで配信");
});

test("独占は1社のときだけ", () => {
  assert.equal(whereLine([row("netflix", "Netflix", { isExclusive: true })], "放送中", NOW), "Netflixで独占配信");
  assert.equal(
    whereLine([row("netflix", "Netflix", { isExclusive: true }), row("abema", "ABEMA")], "放送中", NOW),
    "Netflix・ABEMAで配信"
  );
});

test("3社以上は実際の行数を出し、よく知られたサービスを先に並べる", () => {
  const list = [row("telasa", "TELASA"), row("hulu", "Hulu"), row("prime-video", "Prime Video"), row("u-next", "U-NEXT")];
  assert.equal(whereLine(list, "放送中", NOW), "U-NEXT・Prime Videoなど4社で配信");
});

test("放送前で開始日が不明なら配信予定", () => {
  assert.equal(whereLine([row("abema", "ABEMA")], "放送前", NOW), "ABEMAで配信予定");
});

test("放送前でも、すでに始まったサービスがあれば配信", () => {
  const list = [row("abema", "ABEMA", { firstAvailableAt: NOW - 100 }), row("hulu", "Hulu", { firstAvailableAt: NOW + 100 })];
  assert.equal(isUpcoming(list, "放送前", NOW), false);
});

test("放送中の表示でも、全サービスの開始日が先なら配信予定", () => {
  assert.equal(isUpcoming([row("abema", "ABEMA", { firstAvailableAt: NOW + 100 })], "放送中", NOW), true);
});

test("開始日が分からない放送中の作品は配信中として扱う", () => {
  assert.equal(isUpcoming([row("abema", "ABEMA")], "放送中", NOW), false);
});

test("並べ替えで元の配列を変えない", () => {
  const list = [row("hulu", "Hulu"), row("u-next", "U-NEXT")];
  assert.equal(orderServices(list)[0].serviceKey, "u-next");
  assert.equal(list[0].serviceKey, "hulu");
});

test("これから配信：過去の開始日と開始日不明を除き、同じ日の同じ作品はまとめて、早い順に並べる", () => {
  const e = (anilistId, title, serviceName, firstAvailableAt) => ({ anilistId, title, serviceName, firstAvailableAt });
  const list = upcomingWorks(
    [e(1, "遅い", "Hulu", NOW + 200), e(2, "早い", "ABEMA", NOW + 100), e(2, "早い", "U-NEXT", NOW + 100), e(3, "過去", "FOD", NOW - 1), e(4, "不明", "FOD", null)],
    NOW
  );
  assert.deepEqual(list.map((w) => w.title), ["早い", "遅い"]);
  assert.deepEqual(list[0].services, ["ABEMA", "U-NEXT"]);
});

test("確認日は最新の日付を日本時間で出す", () => {
  // 2026-11-01 15:30 UTC = 2026-11-02 0:30 JST
  const sec = Date.UTC(2026, 10, 1, 15, 30) / 1000;
  assert.equal(jstDateLabel(sec), "2026年11月2日");
  assert.equal(latestCheckedLabel([{ sourceCheckedAt: null }, { sourceCheckedAt: sec }]), "2026年11月2日");
  assert.equal(latestCheckedLabel([{ sourceCheckedAt: null }]), null);
});
