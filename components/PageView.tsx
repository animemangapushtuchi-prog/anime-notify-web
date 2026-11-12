"use client";

// アクセス計測。ページを開くたびに Functions の pv へ小さな通知を送る（中身は lib/track.ts）。
//
// - 本番（www.animiru.com）だけ。自動操作のブラウザ・巡回プログラム・管理画面は数えない
// - 個人を特定する情報やアドレスそのものは送らない（決まった分類名と「work:123」の形のページ名だけ）
// - 2026-11-12〜：初めて来た人／前にも来た人の区別、「読んだ訪問」（画面を動かす・押す、または15秒とどまる）、
//   配信サービスへ移動した回数、ページごとの数を足した。11/9 に巡回プログラムが474人ぶん数えられたため
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { canTrack, jstToday, pageKind, pathKey, refKindOf, send, serviceOfUrl, visitorKind } from "@/lib/track";

let entryRef: string | null = null; // どこから来たか。ページを開いた最初の1回で決める
let refSent = false; // サイト内の移動では送らない

function getEntryRef(): string {
  if (entryRef === null) entryRef = refKindOf(document.referrer);
  return entryRef;
}

export default function PageView() {
  const path = usePathname();

  // 表示のたびに送る
  useEffect(() => {
    try {
      if (!canTrack()) return;
      const today = jstToday();
      const store = window.localStorage;
      const q: Record<string, string> = { u: "0", p: pageKind(path), k: pathKey(path) };
      if (store.getItem("uvDate") !== today) {
        q.v = visitorKind(store, today); // uvDate を書き換える前に判定する
        store.setItem("uvDate", today);
        q.u = "1";
      }
      if (!refSent) {
        q.r = getEntryRef();
        refSent = true;
      }
      send(q);
    } catch {
      /* noop */
    }
  }, [path]);

  // 「読んだ訪問」：その日の最初に、画面を動かす・押す、または15秒とどまったら1回だけ送る
  useEffect(() => {
    let cleanup = () => {};
    try {
      if (!canTrack()) return;
      const today = jstToday();
      const store = window.localStorage;
      if (store.getItem("humanDate") === today) return;
      const events = ["scroll", "pointerdown", "keydown", "touchstart"] as const;
      let done = false;
      const fire = () => {
        if (done) return;
        done = true;
        cleanup();
        try {
          store.setItem("humanDate", today);
          send({ ev: "human", v: visitorKind(store, today), r: getEntryRef() });
        } catch {
          /* noop */
        }
      };
      const timer = window.setTimeout(() => {
        if (document.visibilityState === "visible") fire();
      }, 15000);
      cleanup = () => {
        window.clearTimeout(timer);
        events.forEach((e) => window.removeEventListener(e, fire));
      };
      events.forEach((e) => window.addEventListener(e, fire, { passive: true }));
    } catch {
      /* noop */
    }
    return () => cleanup();
  }, []);

  // 配信サービスへのリンクが押された回数（どのサービスへ送り出せたか）
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      try {
        const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
        const s = a ? serviceOfUrl(a.href) : null;
        if (s) send({ ev: "out", s, k: pathKey(window.location.pathname) });
      } catch {
        /* noop */
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
