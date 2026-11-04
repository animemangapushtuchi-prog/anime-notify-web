// 番組表の題名と AniList の作品の突き合わせ（lib/programMatch.ts）の確認テスト。
// 違う作品の表紙を付けないこと（決められないときは null）を確かめる
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickWork, programKey, searchBase } from "../lib/programMatch.ts";

const c = (id, native, status = "FINISHED") => ({ id, native, status, cover: `c${id}` });

test("期数の書き方が違っても同じ作品とみなす", () => {
  assert.equal(programKey("佐々木とピーちゃん Season2"), programKey("佐々木とピーちゃん シーズン２"));
  assert.equal(programKey("ラブライブ！虹ヶ咲学園スクールアイドル同好会(第2期)"), programKey("ラブライブ！虹ヶ咲学園スクールアイドル同好会 2"));
  assert.notEqual(programKey("佐々木とピーちゃん Season2"), programKey("佐々木とピーちゃん"));
});

test("検索語は期数とかっこ書きを外す", () => {
  assert.equal(searchBase("夜桜さんちの大作戦(第2期)第2クール"), "夜桜さんちの大作戦");
  assert.equal(searchBase("佐々木とピーちゃん Season2"), "佐々木とピーちゃん");
});

test("放送中の同じ題名の作品が1つならそれを選ぶ", () => {
  const list = [c(527, "ポケットモンスター"), c(1, "ポケットモンスター (2019)"), c(2, "ポケットモンスター (2023)", "RELEASING")];
  assert.equal(pickWork("ポケットモンスター", list)?.id, 2);
});

test("同じ題名で始まる作品が放送中なら決めない", () => {
  const list = [c(1, "ダンジョン"), c(2, "ダンジョン 第2期", "RELEASING")];
  assert.equal(pickWork("ダンジョン", list), null);
});

test("記号だけ違う作品は、文字まで同じものを選ぶ", () => {
  assert.equal(pickWork("銀魂", [c(918, "銀魂"), c(2, "銀魂。")])?.id, 918);
});

test("一致しない題名には付けない", () => {
  assert.equal(pickWork("ウルトラマン", [c(1, "ULTRAMAN"), c(2, "ザ☆ウルトラマン")]), null);
  assert.equal(pickWork("Anison Days", [c(3, "アニソン日本")]), null);
});

test("空白の有無は気にしない", () => {
  assert.equal(pickWork("ニャニがニャンだーニャンダーかめん", [c(9810, "ニャニがニャンだー ニャンダーかめん")])?.id, 9810);
});
