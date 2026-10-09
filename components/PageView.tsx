"use client";

// ページビュー計測。ページ遷移ごとにビーコンでFunctionsのpvエンドポイントへ送る。
// 1日1回だけ u=1（ユニーク訪問者）を付ける（localStorage判定）。
//
// 2026-10-09 から：
// - 本番（www.animiru.com）以外と、自動操作のブラウザ（navigator.webdriver）からは送らない。
//   以前は手元の確認用サイトでの動作確認や画面撮影まで本番の数字に入り、作業日だけ数字が跳ねていた
// - 管理画面（/admin）は運営者自身のアクセスなので送らない
// - p＝ページの種類、r＝どこから来たか（ページを開いた最初の1回だけ）も送る。
//   個人を特定する情報やURLそのものは送らない（決まった分類名だけ）
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PV_URL = "https://asia-northeast1-anime-notify-app-86ccc.cloudfunctions.net/pv";
const PROD_HOST = "www.animiru.com";

// ページの種類（Functions 側も同じ一覧だけを受け付ける）
function pageKind(path: string): string {
  if (path === "/") return "top";
  const first = path.split("/")[1] ?? "";
  const known = [
    "work", "streaming", "osusume", "search", "calendar", "me", "notifications",
    "settings", "login", "guide", "survey", "terms", "privacy",
  ];
  return known.includes(first) ? first : "other";
}

// どこから来たか（document.referrer のドメインを分類名にする）
function refKind(): string {
  const ref = document.referrer;
  if (!ref) return "direct";
  let host = "";
  try {
    host = new URL(ref).hostname;
  } catch {
    return "other";
  }
  if (host.endsWith("animiru.com")) return "internal";
  if (/(^|\.)google\./.test(host)) return "google";
  if (/(^|\.)yahoo\.(co\.jp|com)$/.test(host)) return "yahoo";
  if (/(^|\.)bing\.com$/.test(host)) return "bing";
  if (/(^|\.)(t\.co|x\.com|twitter\.com)$/.test(host)) return "x";
  if (/(^|\.)(line\.me|facebook\.com|instagram\.com|threads\.net|youtube\.com|reddit\.com)$/.test(host)) return "sns";
  return "other";
}

let refSent = false; // 参照元はページを開いた最初の1回だけ送る（サイト内の移動では送らない）

export default function PageView() {
  const path = usePathname();
  useEffect(() => {
    try {
      if (window.location.hostname !== PROD_HOST || navigator.webdriver) return;
      if (path.startsWith("/admin")) return;
      const today = new Date().toISOString().slice(0, 10);
      let u = "0";
      if (window.localStorage.getItem("uvDate") !== today) {
        window.localStorage.setItem("uvDate", today);
        u = "1";
      }
      const q = new URLSearchParams({ u, p: pageKind(path) });
      if (!refSent) {
        q.set("r", refKind());
        refSent = true;
      }
      const url = `${PV_URL}?${q.toString()}`;
      if (navigator.sendBeacon) navigator.sendBeacon(url);
      else fetch(url, { method: "POST", keepalive: true }).catch(() => {});
    } catch {
      /* noop */
    }
  }, [path]);
  return null;
}
