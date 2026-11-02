// 作品ページの検索結果用の文（lib/workMeta.ts）の確認テスト。
// 「配信予定」の作品を「配信」と言わないこと、社数が実際の行数と一致することを確かめる
import { test } from "node:test";
import assert from "node:assert/strict";
import { whereLine, isUpcoming, orderServices, latestCheckedLabel, jstDateLabel, upcomingWorks, pickAltNames, workFaq } from "../lib/workMeta.ts";

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

test("別名はかな・カナを含むものだけ残し、題名と同じものは外す", () => {
  const got = pickAltNames("青春ブタ野郎はディアフレンドの夢を見ない", [
    "Rascal Does Not Dream",
    " 青ブタ",
    "青春ブタ野郎はディアフレンドの夢を見ない",
    "进击的巨人",
    "나의 히어로 아카데미아",
    "ジャンプ の アニメ",
  ]);
  assert.deepEqual(got, ["青ブタ", "ジャンプ の アニメ"]);
});

test("よくある質問は確認済みのデータからだけ作る", () => {
  const base = { serviceKey: "netflix", serviceName: "Netflix", firstAvailableAt: null, isExclusive: true, availability: "included", weeklyDay: 3, weeklyTime: "24:00", isFastest: true, sourceCheckedAt: 1793000000 };
  const faq = workFaq({ title: "作品A", status: "放送中", episodes: 12, isSeries: true }, [base], [{ ch: "TOKYO MX", weekday: 6, hhmm: "24:00" }], 1793000000);
  const qs = faq.map((f) => f.q);
  assert.ok(qs.includes("「作品A」は独占配信ですか？"));
  assert.ok(qs.includes("「作品A」が見放題のサービスはどこですか？"));
  assert.ok(faq.some((f) => f.a.includes("最速はNetflixで、毎週水曜 24:00")));
  assert.ok(faq.some((f) => f.a.includes("TOKYO MX（毎週土曜 24:00〜）")));
  assert.ok(!qs.some((q) => q.includes("全何話")));
});

test("配信情報が無く放送枠も無い作品は質問を作らない", () => {
  assert.deepEqual(workFaq({ title: "作品B", status: "放送終了", episodes: 1, isSeries: false }, [], []), []);
});

test("放送が終わった連続作品は全話数を答える", () => {
  const faq = workFaq({ title: "作品C", status: "放送終了", episodes: 24, isSeries: true }, [], []);
  assert.deepEqual(faq, [{ q: "「作品C」は全何話ですか？", a: "全24話です（AniList の登録情報）。" }]);
});

test("放送予定の日付の表し方と、始まったあとの扱い", async () => {
  const { startLabel, isBeforeStart } = await import("../lib/upcomingDates.ts");
  assert.equal(startLabel("2027-01-10"), "2027年1月10日（日）");
  assert.equal(startLabel("2027-01"), "2027年1月");
  const jan1 = Date.UTC(2027, 0, 1) / 1000;
  assert.equal(isBeforeStart("2027-01-10", jan1), true);
  assert.equal(isBeforeStart("2027-01-10", jan1 + 86400 * 20), false);
  assert.equal(isBeforeStart("2027-01", jan1 + 86400 * 20), true); // 月だけのときは月末まで
  assert.equal(isBeforeStart("2027-01", jan1 + 86400 * 40), false);
});
