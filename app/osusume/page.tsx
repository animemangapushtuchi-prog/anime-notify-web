import Link from "next/link";
import type { Metadata } from "next";
import { OG_IMAGE } from "@/lib/seo";
import { listOsusume, thumbWorkIds } from "@/lib/osusume";
import { fetchCovers } from "@/lib/anilist";
import Mascot from "@/components/Mascot";
import OsusumeThumb from "@/components/OsusumeThumb";
import PageHeader from "@/components/PageHeader";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "特集・読みもの｜アニメの配信をデータで比較｜アニミル！",
  description:
    "配信サービスの比較や、今期アニメがどこで見られるかをまとめた記事の一覧。アニミル！の配信データと各サービスの公式情報で確かめたことだけを書いています。",
  alternates: { canonical: "/osusume" },
  openGraph: {
    title: "特集・読みもの｜アニメの配信をデータで比較｜アニミル！",
    description:
      "配信サービスの比較や、今期アニメがどこで見られるかをまとめた記事の一覧。アニミル！の配信データと各サービスの公式情報で確かめたことだけを書いています。",
    url: "/osusume",
    images: [OG_IMAGE],
  },
};

export default async function OsusumeListPage() {
  const list = listOsusume();
  // サムネ背景用のカバー画像をまとめて取得（失敗しても文字だけで成立する）
  const covers = await fetchCovers(thumbWorkIds(list)).catch(() => ({} as Record<number, string>));
  return (
    <main className="mx-auto max-w-2xl px-4 pb-6 lg:max-w-[1400px] lg:px-8">
      <PageHeader
        crumbs={[{ href: "/", label: "ホーム" }, { label: "特集・読みもの" }]}
        eyebrow="Features"
        title="特集・読みもの"
        desc={
          <p>
            アニミル！の配信データと、各サービスの公式情報で確かめたことだけを書いています。
            作品の出来の評価はしていません。
          </p>
        }
        aside={<Mascot pose="thumbsup" h={96} className="hidden lg:block" />}
      />

      {list.length === 0 ? (
        <p className="mt-6 text-sm text-ink-2">特集は準備中です。</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((o, i) => {
            const big = i === 0;
            return (
              <li key={o.slug} className={`reveal ${big ? "sm:col-span-2" : ""}`}>
                <Link
                  href={`/osusume/${o.slug}`}
                  className={`group flex h-full overflow-hidden rounded-3xl border border-line bg-white transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgba(26,21,35,0.5)] ${
                    big ? "flex-col lg:flex-row" : "flex-col"
                  }`}
                >
                  {o.heroImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.heroImage} alt="" className={big ? "h-56 w-full object-cover lg:h-auto lg:w-3/5" : "h-36 w-full object-cover"} />
                  ) : (
                    <OsusumeThumb
                      spec={o.thumb ?? { label: o.title.slice(0, 12) }}
                      images={(o.thumb?.workIds ?? []).map((id) => covers[id]).filter(Boolean)}
                      className={big ? "h-56 w-full lg:h-auto lg:min-h-[280px] lg:w-3/5" : "h-36 w-full"}
                      size={big ? "lg" : "md"}
                    />
                  )}
                  <div className={`flex flex-1 flex-col ${big ? "p-6 lg:p-8" : "p-5"}`}>
                    {big && (
                      <p className="num text-[11px] font-bold uppercase tracking-[0.2em] text-amber-ink">Latest</p>
                    )}
                    <p className={`${big ? "mt-2 text-xl lg:text-2xl" : "text-[15px]"} font-black leading-snug text-ink group-hover:text-amber-ink`}>
                      {o.title}
                    </p>
                    {o.description && (
                      <p className={`mt-2 ${big ? "line-clamp-4" : "line-clamp-2"} text-[13px] leading-relaxed text-ink-2`}>
                        {o.description}
                      </p>
                    )}
                    <p className="mt-auto flex items-center justify-between pt-4 text-[11px] text-ink-2">
                      <span className="num">{o.updatedAt}</span>
                      <span className="font-bold text-amber-ink transition group-hover:translate-x-0.5">読む →</span>
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
