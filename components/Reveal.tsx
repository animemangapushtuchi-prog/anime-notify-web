"use client";

// スクロールで「ふわっと」出す演出。class="reveal" の要素が画面に入ったら data-shown を付ける。
// JS が動かない環境（検索エンジン・印刷・古いブラウザ）では何もしないので、中身は最初から見えている。
// 動きを減らす設定（prefers-reduced-motion）の人には演出しない。
// ログイン状態が分かってから出る部品（マイリストなど）にも効くよう、後から増えた要素も見張る。
import { useEffect } from "react";

export default function Reveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || typeof MutationObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.documentElement.classList.add("js-reveal");

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.shown = "1";
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -6% 0px" }
    );
    const seen = new WeakSet<Element>();
    const scan = () => {
      const vh = window.innerHeight;
      let i = 0;
      document.querySelectorAll<HTMLElement>(".reveal:not([data-shown])").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        // 最初から画面内にあるものはすぐ出す（読み込み直後にちらつかせない）
        if (el.getBoundingClientRect().top < vh * 0.94) {
          el.dataset.shown = "1";
          return;
        }
        el.style.transitionDelay = `${(i++ % 6) * 50}ms`;
        io.observe(el);
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
