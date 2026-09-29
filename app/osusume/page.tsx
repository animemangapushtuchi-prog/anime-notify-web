import Link from "next/link";
import type { Metadata } from "next";
import { OG_IMAGE } from "@/lib/seo";
import { listOsusume, thumbWorkIds } from "@/lib/osusume";
import { fetchCovers } from "@/lib/anilist";
import Mascot from "@/components/Mascot";
import OsusumeThumb from "@/components/OsusumeThumb";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "アニメおすすめ・特集記事一覧｜アニミル！",
  description:
    "テーマ別のおすすめアニメと、配信サービスの比較記事をまとめています。実際の配信データをもとに、どこで見られるかまで紹介。",
  alternates: { canonical: "/osusume" },
  openGraph: {
    title: "アニメおすすめ・特集記事一覧｜アニミル！",
    description:
      "テーマ別のおすすめアニメと、配信サービスの比較記事をまとめています。実際の配信データをもとに、どこで見られるかまで紹介。",
    url: "/osusume",
    images: [OG_IMAGE],
  },
};

export default async function OsusumeListPage() {
  const list = listOsusume();
  // サムネ背景用のカバー画像をまとめて取得（失敗しても文字だけで成立する）
  const covers = await fetchCovers(thumbWorkIds(list)).catch(() => ({} as Record<number, string>));
  return (
    <main className="mx-auto max-w-2xl px-4 py-5 lg:max-w-5xl lg:px-8">
      <div className="flex items-center gap-2">
        <Mascot pose="thumbsup" h={44} />
        <h1 className="text-xl font-extrabold text-[#1C1C2E]">おすすめ・特集</h1>
      </div>
      <p className="mt-1 text-xs text-[#6B7280]">テーマ別のおすすめアニメをランキングで紹介します。</p>

      {list.length === 0 ? (
        <p className="mt-6 text-sm text-black/50">特集は準備中です。</p>
      ) : (
        <ul className="mt-4 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {list.map((o) => (
            <li key={o.slug}>
              <Link
                href={`/osusume/${o.slug}`}
                className="block overflow-hidden rounded-2xl border border-[#ECECF2] bg-white"
              >
                {o.heroImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.heroImage} alt={o.title} className="h-32 w-full object-cover" />
                ) : (
                  <OsusumeThumb
                    spec={o.thumb ?? { label: o.title.slice(0, 12) }}
                    images={(o.thumb?.workIds ?? []).map((id) => covers[id]).filter(Boolean)}
                    className="h-32 w-full"
                  />
                )}
                <div className="p-3">
                  <p className="text-sm font-extrabold text-[#1C1C2E]">{o.title}</p>
                  {o.description && <p className="mt-1 line-clamp-2 text-xs text-[#6B7280]">{o.description}</p>}
                  <p className="mt-1 text-[11px] font-bold text-[#8A5518]">
                    {o.entries.length > 0 ? `${o.entries.length}作品を紹介` : "解説記事"} ›
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
