// アクセス計測の分類（lib/track.ts）の確認テスト
import { test } from "node:test";
import assert from "node:assert/strict";
import { jstToday, pageKind, pathKey, refKindOf, serviceOfUrl, visitorKind } from "../lib/track.ts";

const store = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), m };
};

test("ページのキーは作品・配信一覧・記事だけ細かく分ける", () => {
  assert.equal(pathKey("/"), "top");
  assert.equal(pathKey("/work/153518"), "work:153518");
  assert.equal(pathKey("/work/abc"), "work");
  assert.equal(pathKey("/streaming/2026-fall/netflix"), "streaming:2026-fall:netflix");
  assert.equal(pathKey("/streaming/weekly"), "streaming:weekly");
  assert.equal(pathKey("/osusume/prime-video-2026-aki-anime"), "osusume:prime-video-2026-aki-anime");
  assert.equal(pathKey("/settings/anything"), "settings");
  assert.equal(pathKey("/unknown/page"), "other");
  assert.equal(pageKind("/streaming/planner"), "streaming");
});

test("配信サービスへのリンクを見分ける", () => {
  assert.equal(serviceOfUrl("https://video.unext.jp/title/SID0004917"), "u-next");
  assert.equal(serviceOfUrl("https://animestore.docomo.ne.jp/animestore/ci_pc?workId=1"), "d-anime");
  assert.equal(serviceOfUrl("https://www.amazon.co.jp/s?k=x&i=instant-video"), "prime-video");
  assert.equal(serviceOfUrl("https://www.b-ch.com/titles/1/"), "bandai-channel");
  assert.equal(serviceOfUrl("https://ja.wikipedia.org/wiki/x"), null);
  assert.equal(serviceOfUrl("/work/1"), null);
});

test("どこから来たかの分類", () => {
  assert.equal(refKindOf(""), "direct");
  assert.equal(refKindOf("https://www.google.co.jp/"), "google");
  assert.equal(refKindOf("https://search.yahoo.co.jp/search?p=x"), "yahoo");
  assert.equal(refKindOf("https://t.co/abc"), "x");
  assert.equal(refKindOf("https://www.animiru.com/"), "internal");
});

test("初めて来た人と前にも来た人", () => {
  const a = store();
  assert.equal(visitorKind(a, "2026-11-12"), "new");
  assert.equal(visitorKind(a, "2026-11-12"), "new"); // 同じ日は何度見ても初回
  assert.equal(visitorKind(a, "2026-11-13"), "back");
  // 以前の計測だけ残っている人は再訪として扱う
  assert.equal(visitorKind(store({ uvDate: "2026-11-01" }), "2026-11-12"), "back");
});

test("日付は日本時間で区切る", () => {
  assert.equal(jstToday(Date.UTC(2026, 10, 11, 15, 0)), "2026-11-12"); // 日本時間 0:00
  assert.equal(jstToday(Date.UTC(2026, 10, 11, 14, 59)), "2026-11-11");
});
