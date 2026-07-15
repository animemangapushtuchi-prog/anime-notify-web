"use client";

// iPhone(Safari・非PWA)の人にだけ、ホーム画面追加を案内するバナー（通知はPWAでないと不可）。
import { useEffect, useState } from "react";

export default function IosBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      const ua = window.navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        // iOS Safari 独自プロパティ
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      const dismissed = window.localStorage.getItem("iosBannerDismissed") === "1";
      if (isIOS && !standalone && !dismissed) setShow(true);
    } catch {}
  }, []);
  if (!show) return null;
  return (
    <div className="mx-auto max-w-2xl px-4 pt-3">
      <div className="rounded-2xl border border-[#F3D9A9] bg-[#FEF3C7] p-3 text-xs leading-relaxed text-[#7C5B12]">
        <p className="font-bold">📱 iPhoneで通知を使うには</p>
        <p className="mt-1">
          Safariの共有ボタン →「ホーム画面に追加」して、追加したアイコンから開いてください。iOSの仕様で、この操作をしないと通知が使えません。
        </p>
        <button
          type="button"
          onClick={() => {
            try {
              window.localStorage.setItem("iosBannerDismissed", "1");
            } catch {}
            setShow(false);
          }}
          className="mt-2 font-bold text-[#7C5B12] underline"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
