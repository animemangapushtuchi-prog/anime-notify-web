import type { Metadata } from "next";

// me はログイン前提の画面。検索結果に出す意味がないので noindex にする。
// （本体が "use client" のため、metadata はこの layout 側で指定する）
export const metadata: Metadata = {
  title: "マイリスト｜アニミル！",
  robots: { index: false, follow: true },
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
