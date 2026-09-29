import type { Metadata } from "next";

// 管理画面（/admin と /admin/streaming）。検索結果に出さない。
export const metadata: Metadata = {
  title: "管理画面｜アニミル！",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
