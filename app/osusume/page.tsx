import Link from "next/link";
import type { Metadata } from "next";
import { listOsusume } from "@/lib/osusume";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "おすすめ・特集｜Animiru",
  description: "テーマ別のおすすめアニメをランキングで紹介する特集ページ。あらすじ・見どころ・配信先つき。",
};

export default function OsusumeListPage() {
  const list = listOsusume();
  return (
    <main className="mx-auto max-w-2xl px-4 py-5 lg:max-w-5xl lg:px-8">
      <h1 className="text-xl font-extrabold text-[#1C1C2E]">おすすめ・特集</h1>
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
                  <div className="h-20 w-full" style={{ background: "linear-gradient(to bottom right, #3B3670, #5B4FCF)" }} />
                )}
                <div className="p-3">
                  <p className="text-sm font-extrabold text-[#1C1C2E]">{o.title}</p>
                  {o.description && <p className="mt-1 line-clamp-2 text-xs text-[#6B7280]">{o.description}</p>}
                  <p className="mt-1 text-[11px] font-bold text-[#5B4FCF]">{o.entries.length}作品 ›</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
