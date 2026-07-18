"use client";

// 手動配置のディスプレイ広告ユニット（レスポンシブ）。
// slot（data-ad-slot）が未設定のときは何も描画しない（＝審査/設定前でも安全）。
import { useEffect, useRef } from "react";

const CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "ca-pub-6458901222804186";

export default function AdSlot({
  slot,
  className = "",
}: {
  slot?: string;
  className?: string;
}) {
  const s = slot ?? process.env.NEXT_PUBLIC_ADSENSE_SLOT ?? "";
  const pushed = useRef(false);

  useEffect(() => {
    if (!s || pushed.current) return;
    try {
      // @ts-expect-error adsbygoogle はスクリプトが注入するグローバル
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      /* noop */
    }
  }, [s]);

  if (!s) return null;

  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={CLIENT}
        data-ad-slot={s}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
