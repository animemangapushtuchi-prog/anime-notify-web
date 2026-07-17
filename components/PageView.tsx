"use client";

// ページビュー計測。ページ遷移ごとにビーコンでFunctionsのpvエンドポイントへ送る。
// 1日1回だけ u=1（ユニーク訪問者）を付ける（localStorage判定）。
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PV_URL = "https://asia-northeast1-anime-notify-app-86ccc.cloudfunctions.net/pv";

export default function PageView() {
  const path = usePathname();
  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      let u = "0";
      if (window.localStorage.getItem("uvDate") !== today) {
        window.localStorage.setItem("uvDate", today);
        u = "1";
      }
      const url = `${PV_URL}?u=${u}`;
      if (navigator.sendBeacon) navigator.sendBeacon(url);
      else fetch(url, { method: "POST", keepalive: true }).catch(() => {});
    } catch {
      /* noop */
    }
  }, [path]);
  return null;
}
