import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getOsusume, listOsusumeSlugs, listOsusume, articleWorkIds, tocOf } from "@/lib/osusume";
import Mascot from "@/components/Mascot";
import { fetchWorkBriefs, type WorkBrief } from "@/lib/anilist";
import OsusumeThumb from "@/components/OsusumeThumb";

export const revalidate = 3600;

// 記事で使う作品の表紙・タイトル。generateMetadata（OGP画像）と本文で同じ結果を使い回し、
// AniList への問い合わせを1記事1回に抑える（ビルド時のレート制限対策）
const loadBriefs = cache(async (slug: string): Promise<Record<number, WorkBrief>> => {
  const o = getOsusume(slug);
  const need = o ? articleWorkIds(o) : [];
  return need.length ? fetchWorkBriefs(need) : {};
});

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
  if (!o) return { title: "特集が見つかりません｜アニミル！" };
  const desc = o.description ?? o.intro?.slice(0, 120) ?? "";
  const url = `https://www.animiru.com/osusume/${slug}`;

  // シェア用の画像。記事に heroImage が無い場合（＝現在の全記事）は
  // 紹介している作品の表紙を使う。画像が無いとSNSでの見え方が弱くなるため。
  let image = o.heroImage ?? "";
  if (!image) {
    const first = articleWorkIds(o)[0];
    if (first) image = (await loadBriefs(slug))[first]?.cover ?? "";
  }

  return {
    title: `${o.title}｜アニミル！`,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: o.title,
      description: desc,
      url,
      images: image ? [image] : [],
      type: "article",
      ...(o.updatedAt ? { modifiedTime: `${o.updatedAt}T00:00:00+09:00` } : {}),
    },
    twitter: {
      // 作品の表紙は縦長なので、横長カード(summary_large_image)だと上下が切れる。
      // 小さめの正方形サムネで出す summary の方が見栄えがよい。
      card: "summary",
      title: o.title,
      description: desc,
      images: image ? [image] : [],
    },
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

  // サムネ背景・本文の作品カード・ランキングで使う表紙をまとめて取得
  const briefs = await loadBriefs(slug);
  const covers: Record<number, string> = {};
  for (const [id, b] of Object.entries(briefs)) covers[Number(id)] = b.cover;
  const others = listOsusume().filter((x) => x.slug !== slug).slice(0, 4);

  // 構造化データ。
  // 以前は o.entries だけを見ていたが、解説記事（本文形式）は entries が空なので
  // itemListElement が [] のまま出力され、Googleには無効なデータになっていた。
  // 本文の作品カードからも作品を拾い、それも無い記事は記事(BlogPosting)として出す。
  // URLは canonical と同じ www 付きに揃える。
  const SITE = "https://www.animiru.com";
  const listItems =
    o.entries.length > 0
      ? o.entries.map((e) => ({
          "@type": "ListItem" as const,
          position: e.rank,
          name: e.title,
          ...(e.workId ? { url: `${SITE}/work/${e.workId}` } : {}),
        }))
      : (o.body ?? [])
          .flatMap((s) => s.works?.ids ?? [])
          .filter((id, i, arr) => arr.indexOf(id) === i)
          .map((id, i) => ({
            "@type": "ListItem" as const,
            position: i + 1,
            name: briefs[id]?.title ?? `作品 #${id}`,
            url: `${SITE}/work/${id}`,
          }));

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ホーム", item: SITE },
      { "@type": "ListItem", position: 2, name: "おすすめ・特集", item: `${SITE}/osusume` },
      { "@type": "ListItem", position: 3, name: o.title, item: `${SITE}/osusume/${slug}` },
    ],
  };

  const main =
    listItems.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: o.title,
          description: o.description ?? "",
          itemListElement: listItems,
        }
      : {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: o.title,
          description: o.description ?? "",
          mainEntityOfPage: `${SITE}/osusume/${slug}`,
          ...(o.updatedAt
            ? {
                datePublished: `${o.updatedAt}T00:00:00+09:00`,
                dateModified: `${o.updatedAt}T00:00:00+09:00`,
              }
            : {}),
          publisher: { "@type": "Organization", name: "アニミル！", url: SITE },
        };

  const jsonLd = [breadcrumb, main];

  return (
    <main className="mx-auto max-w-2xl px-4 pb-6 lg:max-w-[1180px] lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="パンくずリスト" className="pt-4 text-[11px] text-ink-2 lg:pt-6">
        <ol className="flex flex-wrap items-center gap-1">
          <li><Link href="/" className="transition hover:text-amber-ink">ホーム</Link></li>
          <li aria-hidden="true" className="text-ink-2/60">/</li>
          <li><Link href="/osusume" className="transition hover:text-amber-ink">特集・読みもの</Link></li>
          <li aria-hidden="true" className="text-ink-2/60">/</li>
          <li aria-current="page" className="line-clamp-1 text-ink">{o.title}</li>
        </ol>
      </nav>

      {/* ヒーロー：絵（サムネ）を大きく、その下に夜色の見出し */}
      <section className="mt-4 overflow-hidden rounded-[28px] bg-night text-white shadow-[0_30px_80px_-40px_rgba(21,17,42,0.9)]">
        {o.heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={o.heroImage} alt="" className="h-48 w-full object-cover lg:h-72" />
        ) : o.thumb ? (
          <OsusumeThumb
            spec={o.thumb}
            images={(o.thumb.workIds ?? []).map((id) => covers[id]).filter(Boolean)}
            className="h-48 w-full lg:h-72"
            size="lg"
          />
        ) : null}
        <div className="relative px-6 pb-8 pt-7 lg:px-12 lg:pb-11 lg:pt-9">
          <div aria-hidden="true" className="starfield absolute inset-0 opacity-50" />
          <p className="num relative text-[11px] font-bold uppercase tracking-[0.22em] text-bell">Feature</p>
          <h1 className="relative mt-2 max-w-4xl text-[24px] font-black leading-[1.35] lg:text-[36px]">{o.title}</h1>
          {o.updatedAt && <p className="relative mt-3 text-xs text-white/65">更新 <span className="num">{o.updatedAt}</span></p>}
          {o.intro && <p className="relative mt-4 max-w-3xl whitespace-pre-line text-[14px] leading-[1.95] text-white/80">{o.intro}</p>}
        </div>
      </section>

      <div className="mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-14">
      <div className="mx-auto min-w-0 max-w-[720px] lg:order-1 lg:mx-0 lg:max-w-none">
      {/* 目次：どんな内容か一目で分かり、読みたい所へ飛べる */}
      {o.body && o.body.length > 2 && (
        <nav aria-label="目次" className="rounded-3xl border border-line bg-white p-5 lg:hidden">
          <p className="flex items-center gap-1.5 text-[13px] font-extrabold text-[#1A1523]">
            <span className="inline-block h-4 w-1 rounded-full bg-[#A8621F]" />
            この記事の内容
          </p>
          <ol className="mt-2.5 space-y-1.5">
            {tocOf(o).map((t, i) => (
              <li key={t.id} className="flex gap-2">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#F6E9D5] text-[10px] font-black text-[#8A5518]">
                  {i + 1}
                </span>
                <a href={`#${t.id}`} className="text-[13px] leading-snug text-[#3A3342] hover:text-amber-ink hover:underline">
                  {t.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* 解説本文（見出し＋段落）。読み物系の記事で使う */}
      {o.body && o.body.length > 0 && (
        <article className="mt-8 space-y-12 lg:mt-0">
          {o.body.map((s, i) => (
            <section key={i} id={`sec-${i}`} className="scroll-mt-20">
              <h2 className="border-t border-line pt-6 text-[21px] font-black leading-[1.45] text-ink lg:text-[24px]">
                <span className="num mb-2 block text-xs font-bold tracking-[0.2em] text-amber-ink">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.heading}
              </h2>

              {s.text && (
                <div className="mt-4 space-y-5">
                  {s.text.split("\n\n").map((p, j) => (
                    <p key={j} className="whitespace-pre-line text-[15px] leading-[2] text-[#3A3342]">
                      {p}
                    </p>
                  ))}
                </div>
              )}

              {/* 数字カード：要点を数字で見せる */}
              {s.stats && s.stats.items.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {s.stats.items.map((it, j) => (
                    <div
                      key={j}
                      className="rounded-2xl border border-[#ECE5DA] bg-white p-3 text-center"
                      style={{ borderTopColor: it.color || "#C2772A", borderTopWidth: 3 }}
                    >
                      <p className="text-[20px] font-black leading-tight" style={{ color: it.color || "#C2772A" }}>
                        {it.value}
                      </p>
                      <p className="mt-0.5 text-[11px] font-bold text-[#1A1523]">{it.label}</p>
                      {it.note && <p className="mt-0.5 text-[10px] text-[#625B6E]">{it.note}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* 良い点・注意点の対比 */}
              {s.pros && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#C0DD97] bg-[#EAF3DE] p-3.5">
                    <p className="text-[13px] font-extrabold text-[#3B6D11]">
                      {s.pros.goodTitle ?? "こんな人に向いている"}
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {s.pros.good.map((g, j) => (
                        <li key={j} className="flex gap-1.5 text-[12px] leading-snug text-[#3A3342]">
                          <span className="flex-none font-black text-[#3B6D11]">○</span>
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-[#F7C1C1] bg-[#FDEAEA] p-3.5">
                    <p className="text-[13px] font-extrabold text-[#A32D2D]">
                      {s.pros.badTitle ?? "向いていない場合"}
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {s.pros.bad.map((b, j) => (
                        <li key={j} className="flex gap-1.5 text-[12px] leading-snug text-[#3A3342]">
                          <span className="flex-none font-black text-[#A32D2D]">×</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* マスコットの吹き出し：読みのリズムを作る */}
              {s.balloon && (
                <div className="mt-3 flex items-end gap-2">
                  <Mascot pose={s.balloon.pose ?? "stand"} h={56} className="flex-none" />
                  <div className="relative flex-1 rounded-2xl border border-[#E7C9A0] bg-[#FBF3E6] px-3.5 py-2.5">
                    <span
                      aria-hidden="true"
                      className="absolute -left-1.5 bottom-4 h-3 w-3 rotate-45 border-b border-l border-[#E7C9A0] bg-[#FBF3E6]"
                    />
                    <p className="whitespace-pre-line text-[13px] leading-relaxed text-[#3A3342]">
                      {s.balloon.text}
                    </p>
                  </div>
                </div>
              )}

              {/* 作品カード（表紙つき）。解説記事に絵を入れる主役 */}
              {s.works && s.works.ids.length > 0 && (
                <div className="mt-3">
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                    {s.works.ids.map((id) => {
                      const b = briefs[id];
                      if (!b) return null;
                      return (
                        <li key={id}>
                          <Link href={`/work/${id}`} className="group block">
                            <span className="block aspect-[2/3] w-full overflow-hidden rounded-xl bg-black/5">
                              {b.cover && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={b.cover}
                                  alt={b.title}
                                  className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                                />
                              )}
                            </span>
                            <span className="mt-1 line-clamp-2 block text-[11px] font-bold leading-snug text-[#1A1523]">
                              {b.title}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {s.works.note && (
                    <p className="mt-2 text-[11px] text-[#625B6E]">{s.works.note}</p>
                  )}
                </div>
              )}

              {/* 補足・注意の囲み */}
              {s.callout && (
                <div
                  className={`mt-3 rounded-2xl border-l-4 p-3.5 ${
                    s.callout.tone === "warn"
                      ? "border-[#DC2626] bg-[#FDEAEA]"
                      : s.callout.tone === "tip"
                        ? "border-[#3B6D11] bg-[#EAF3DE]"
                        : "border-[#C2772A] bg-[#FBF3E6]"
                  }`}
                >
                  {s.callout.title && (
                    <p className="text-[13px] font-extrabold text-[#1A1523]">{s.callout.title}</p>
                  )}
                  <p className="mt-0.5 whitespace-pre-line text-[13px] leading-relaxed text-[#3A3342]">
                    {s.callout.text}
                  </p>
                </div>
              )}

              {/* 横棒グラフ（カバー率などの比較） */}
              {s.bars && (
                <div className="mt-3 rounded-2xl border border-[#ECE5DA] bg-white p-4">
                  <div className="space-y-2.5">
                    {s.bars.items.map((b, j) => {
                      const max = b.max ?? Math.max(...s.bars!.items.map((x) => x.value));
                      const pct = max > 0 ? Math.round((b.value / max) * 100) : 0;
                      return (
                        <div key={j} className="flex items-center gap-2">
                          <span className="w-28 flex-none text-[12px] font-bold text-[#1A1523]">{b.label}</span>
                          <span className="h-4 flex-1 overflow-hidden rounded-full bg-[#F2ECE3]">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${pct}%`, background: b.color || "#C2772A" }}
                            />
                          </span>
                          <span className="w-16 flex-none text-right text-[12px] font-bold text-[#1A1523]">
                            {b.value}
                            {b.suffix ?? ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {s.bars.note && <p className="mt-2.5 text-[11px] text-[#625B6E]">{s.bars.note}</p>}
                </div>
              )}

              {/* 比較表 */}
              {s.table && (
                <div className="mt-3">
                  <div className="overflow-x-auto rounded-2xl border border-[#ECE5DA]">
                    <table className="w-full border-collapse bg-white text-[13px]">
                      <thead>
                        <tr className="bg-[#FBF3E6]">
                          {s.table.head.map((h, j) => (
                            <th
                              key={j}
                              className="whitespace-nowrap border-b border-[#ECE5DA] px-3 py-2 text-left font-bold text-[#8A5518]"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {s.table.rows.map((r, j) => (
                          <tr key={j} className="border-b border-[#F2ECE3] last:border-0">
                            {r.map((c, k) => (
                              <td
                                key={k}
                                className={`px-3 py-2 align-top ${k === 0 ? "font-bold text-[#1A1523]" : "text-[#3A3342]"}`}
                              >
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {s.table.note && <p className="mt-2 text-[11px] text-[#625B6E]">{s.table.note}</p>}
                </div>
              )}
            </section>
          ))}
        </article>
      )}

      {/* ランキング */}
      <ol className="mt-4 space-y-4">
        {o.entries.map((e) => {
          const img = e.image || (e.workId ? covers[e.workId] : "") || "";
          const rankColor = RANK_BG[e.rank - 1] ?? "#C2772A";
          return (
            <li key={`${e.rank}-${e.title}`} className="overflow-hidden rounded-2xl border border-[#ECE5DA] bg-white">
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
                    <Link href={`/work/${e.workId}`} className="text-[15px] font-extrabold text-[#1A1523] hover:text-[#C2772A]">
                      {e.title}
                    </Link>
                  ) : (
                    <p className="text-[15px] font-extrabold text-[#1A1523]">{e.title}</p>
                  )}
                  {e.reviewTitle && <p className="mt-1 text-[13px] font-bold text-[#C2772A]">{e.reviewTitle}</p>}
                  {e.reviewBody && (
                    <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-[#3A3342]">{e.reviewBody}</p>
                  )}
                </div>
              </div>

              {((e.streaming && e.streaming.length > 0) || e.workId) && (
                <div className="flex flex-wrap items-center gap-2 border-t border-[#F2ECE3] px-3 py-2">
                  {e.streaming?.map((s) => (
                    <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#F6E9D5] px-3 py-1 text-[11px] font-bold text-[#8A5518]">
                      {s.name}で見る ↗
                    </a>
                  ))}
                  {e.workId && (
                    <Link href={`/work/${e.workId}`} className="ml-auto rounded-full bg-[#A8621F] px-3 py-1 text-[11px] font-bold text-white">
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
      <section className="grain relative mt-14 overflow-hidden rounded-3xl bg-amber-soft px-6 py-8 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p className="text-lg font-black text-ink">気になった作品は、見張っておこう。</p>
          <p className="mt-1 text-sm text-ink-2">作品ページの「通知登録」で、新しい話の放送・配信入りをお知らせします。</p>
        </div>
        <div className="mt-5 flex flex-none items-end gap-3 sm:mt-0">
          <Link href="/search" className="rounded-full bg-amber-deep px-5 py-2.5 text-sm font-bold text-white transition hover:bg-amber-ink">
            作品をさがす
          </Link>
          <Mascot pose="point" h={84} className="hidden sm:block" />
        </div>
      </section>
      </div>

      {/* 目次（PC）：右側に固定して、今どこを読んでいるか分かるようにする */}
      {o.body && o.body.length > 2 && (
        <aside className="hidden lg:order-2 lg:block">
          <nav aria-label="目次" className="sticky top-6 rounded-3xl border border-line bg-white p-5">
            <p className="num text-[11px] font-bold uppercase tracking-[0.2em] text-amber-ink">Contents</p>
            <ol className="mt-3 space-y-2.5">
              {tocOf(o).map((t, i) => (
                <li key={t.id} className="flex gap-2.5">
                  <span className="num w-5 flex-none pt-px text-[11px] font-bold text-ink-2">{String(i + 1).padStart(2, "0")}</span>
                  <a href={`#${t.id}`} className="text-[13px] leading-snug text-ink-2 transition hover:text-amber-ink">
                    {t.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
      )}
      </div>

      {/* 関連特集 */}
      {others.length > 0 && (
        <section className="mt-16 border-t border-line pt-10">
          <p className="num text-[11px] font-bold uppercase tracking-[0.22em] text-amber-ink">More features</p>
          <h2 className="mt-2 text-2xl font-black text-ink">ほかの特集</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((x) => (
              <li key={x.slug}>
                <Link
                  href={`/osusume/${x.slug}`}
                  className="group flex h-full items-start justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-4 text-sm font-bold leading-snug text-ink transition hover:-translate-y-0.5 hover:border-amber"
                >
                  <span className="group-hover:text-amber-ink">{x.title}</span>
                  <span aria-hidden="true" className="text-amber-ink transition group-hover:translate-x-0.5">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
