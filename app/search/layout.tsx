import type { Metadata } from "next";
import { OG_IMAGE } from "@/lib/seo";

// 検索ページ本体は "use client" のため metadata を持てない。
// これが無いとトップと同じタイトル・説明文になってしまうので、ここで指定する。
const TITLE = "アニメ・漫画を検索｜今期放送中・スタジオ・声優から探す｜アニミル！";
const DESC =
  "アニメや漫画をタイトル・制作スタジオ・声優から検索できます。今期放送中や来期放送予定の作品も一覧で探せます。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/search" },
  openGraph: { title: TITLE, description: DESC, url: "/search", images: [OG_IMAGE] },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
