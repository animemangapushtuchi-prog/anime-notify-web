// サブスクの組み合わせ計算（lib/planner.ts）の確認テスト
import { test } from "node:test";
import assert from "node:assert/strict";
import { bestBySize, cheapestPlan, coverage } from "../lib/planner.ts";

const prices = { a: 500, b: 700, c: 1000, d: 2000 };
const w = (id, ...services) => ({ id, title: `作品${id}`, cover: "", services });

test("1社で足りるなら安いほうを選ぶ", () => {
  const r = cheapestPlan([w(1, "a", "b"), w(2, "a", "c")], prices);
  assert.deepEqual(r.services, ["a"]);
  assert.equal(r.total, 500);
  assert.equal(r.covered, 2);
});

test("独占作品があると必ずそのサービスが入る", () => {
  const r = cheapestPlan([w(1, "a"), w(2, "d")], prices);
  assert.deepEqual(r.services, ["a", "d"]);
  assert.equal(r.total, 2500);
});

test("高い1社より安い2社のほうが安ければ2社にする", () => {
  const r = cheapestPlan([w(1, "a", "d"), w(2, "b", "d")], prices);
  assert.deepEqual(r.services, ["a", "b"]);
  assert.equal(r.total, 1200);
});

test("同じ金額なら契約数が少ないほうを選ぶ", () => {
  const r = cheapestPlan([w(1, "a", "c"), w(2, "x", "c")], { a: 300, x: 700, c: 1000 });
  assert.deepEqual(r.services, ["c"]);
});

test("料金が分からないサービスだけの作品は見られない作品として返す", () => {
  const r = cheapestPlan([w(1, "a"), w(2, "unknown"), w(3)], prices);
  assert.deepEqual(r.services, ["a"]);
  assert.deepEqual(r.missing.map((x) => x.id), [2, 3]);
});

test("何も選ばなければ何も契約しない", () => {
  const r = cheapestPlan([], prices);
  assert.deepEqual(r.services, []);
  assert.equal(r.total, 0);
});

test("社数ごとの最大カバー：同数なら安いほう", () => {
  const works = [w(1, "a", "b"), w(2, "a", "b"), w(3, "c")];
  const one = bestBySize(works, prices, 1);
  assert.deepEqual(one.services, ["a"]);
  assert.equal(one.covered, 2);
  const two = bestBySize(works, prices, 2);
  assert.deepEqual(two.services, ["a", "c"]);
  assert.equal(two.covered, 3);
});

test("作品数を数える", () => {
  assert.equal(coverage([w(1, "a"), w(2, "b"), w(3, "a", "b")], "a"), 2);
});
