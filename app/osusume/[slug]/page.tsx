import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getOsusume, listOsusumeSlugs, listOsusume } from "@/lib/osusume";
import { fetchCovers } from "@/lib/anilist";

export const revalidate = 3600;

export function generateStaticParams() {
  return listOsusumeSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const o = getOsusume(slug);
  if (!o) return { title: "特集が見つかりません" };
  const desc = o.description ?? o.intro?.slice(0, 120) ?? "";
  return {
    title: `${o.title}｜Animiru`,
    description: desc,
    openGraph: { title: o.title, description: desc, images: o.heroImage ? [o.heroImage] : [], type: "article" },
  };
}

const RANK_BG = ["#F5C518", "#B7C0CC", "#CD8B62"]; // 金・銀・銅

export default async function OsusumeDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const o = getOsusume(slug);
  if (!o) notFound();

  const need = o.entries.filter((e) => e.workId && !e.image).map((e) => e.workId as number);
  const covers = need.length ? await fetchCovers(need) : {};
  const others = listOsusume().filter((x) => x.slug !== slug).slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: o.title,
    description: o.description ?? "",
    itemListElement: o.entries.map((e) => ({
      "@type": "ListItem",
      position: e.rank,
      name: e.title,
      ...(e.workId ? { url: `https://animiru.com/work/${e.workId}` } : {}),
    })),
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="text-[11px] text-[#6B7280]">
        <Link href="/osusume" className="hover:underline">おすすめ・特集</Link> ›
      </nav>

      {/* ヒーロー */}
      <section className="mt-2 overflow-hidden rounded-2xl text-white" style={{ background: "linear-gradient(to bottom right, #3B3670, #5B4FCF)" }}>
        {o.heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={o.heroImage} alt={o.title} className="h-40 w-full object-cover" />
        )}
        <div className="p-4">
          <h1 className="text-xl font-extrabold leading-snug">{o.title}</h1>
          {o.updatedAt && <p className="mt-1 text-[11px] text-white/70">更新：{o.updatedAt}</p>}
          {o.intro && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/90">{o.intro}</p>}
        </div>
      </section>

      {/* ランキング */}
      <ol className="mt-4 space-y-4">
        {o.entries.map((e) => {
          const img = e.image || (e.workId ? covers[e.workId] : "") || "";
          const rankColor = RANK_BG[e.rank - 1] ?? "#5B4FCF";
          return (
            <li key={`${e.rank}-${e.title}`} className="overflow-hidden rounded-2xl border border-[#ECECF2] bg-white">
              <div className="flex gap-3 p-3">
                <span
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm font-black text-white"
                  style={{ background: rankColor }}
                >
                  {e.rank}
                </span>
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={e.title} className="h-28 w-20 flex-none rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  {e.workId ? (
                    <Link href={`/work/${e.workId}`} className="text-[15px] font-extrabold text-[#1C1C2E] hover:text-[#5B4FCF]">
                      {e.title}
                    </Link>
                  ) : (
                    <p className="text-[15px] font-extrabold text-[#1C1C2E]">{e.title}</p>
                  )}
                  {e.reviewTitle && <p className="mt-1 text-[13px] font-bold text-[#5B4FCF]">{e.reviewTitle}</p>}
                  {e.reviewBody && (
                    <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-[#374151]">{e.reviewBody}</p>
                  )}
                </div>
              </div>

              {((e.streaming && e.streaming.length > 0) || e.workId) && (
                <div className="flex flex-wrap items-center gap-2 border-t border-[#F1F1F5] px-3 py-2">
                  {e.streaming?.map((s) => (
                    <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#ECEAFD] px-3 py-1 text-[11px] font-bold text-[#5B4FCF]">
                      {s.name}で見る ↗
                    </a>
                  ))}
                  {e.workId && (
                    <Link href={`/work/${e.workId}`} className="ml-auto rounded-full bg-[#5B4FCF] px-3 py-1 text-[11px] font-bold text-white">
                      詳細・＋通知登録 ›
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* CTA */}
      <section className="mt-6 rounded-2xl border border-[#ECEAFD] bg-[#F6F5FF] p-4 text-center">
        <p className="text-sm font-bold text-[#1C1C2E]">気になった作品は「＋登録」で新着通知！</p>
        <p className="mt-1 text-xs text-[#6B7280]">新話の放送・配信入りを自動でお知らせします。</p>
        <Link href="/" className="mt-3 inline-block rounded-full bg-[#5B4FCF] px-5 py-2 text-sm font-bold text-white">
          アプリを使ってみる
        </Link>
      </section>

      {/* 関連特集 */}
      {others.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-bold text-[#6B7280]">ほかの特集</h2>
          <ul className="mt-2 space-y-2">
            {others.map((x) => (
              <li key={x.slug}>
                <Link href={`/osusume/${x.slug}`} className="block rounded-xl border border-[#ECECF2] bg-white px-3 py-2 text-sm font-bold text-[#1C1C2E] hover:text-[#5B4FCF]">
                  {x.title} ›
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
