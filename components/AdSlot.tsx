"use client";

// 広告枠。2026-10-29 から2種類に対応：
// 1. content/ads.json の display.slots に、この枠（name）の広告タグがあれば、それを iframe で出す（AdSense 以外の広告会社）
// 2. 無ければ従来どおり AdSense（data-ad-slot が設定されているときだけ）
// どちらも設定が無いときは何も描画しない（＝審査前・登録前でも安全）。
import { useEffect, useRef } from "react";
import config from "@/content/ads.json";

const CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "ca-pub-6458901222804186";

type Slot = { html?: string; width?: number; height?: number };
const SLOTS = (config as { display?: { slots?: Record<string, Slot> } }).display?.slots ?? {};

export default function AdSlot({
  name,
  slot,
  className = "",
}: {
  name?: "work" | "search" | "mylist" | "streaming"; // 枠の名前（content/ads.json の display.slots のキー）
  slot?: string; // AdSense の data-ad-slot
  className?: string;
}) {
  const other = name ? SLOTS[name] : undefined;
  const useOther = !!(other?.html && other.width && other.height);
  const s = useOther ? "" : slot ?? process.env.NEXT_PUBLIC_ADSENSE_SLOT ?? "";
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

  if (useOther) {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <p className="mb-1 text-[10px] text-ink-2">広告</p>
        <iframe
          src={`/ad-frame/${name}`}
          title="広告"
          width={other!.width}
          height={other!.height}
          loading="lazy"
          scrolling="no"
          className="max-w-full border-0"
        />
      </div>
    );
  }

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
