import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getOsusume, listOsusumeSlugs, listOsusume, articleWorkIds, tocOf } from "@/lib/osusume";
import Mascot from "@/components/Mascot";
import { fetchWorkBriefs } from "@/lib/anilist";
import OsusumeThumb from "@/components/OsusumeThumb";

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

  // サムネ背景・本文の作品カード・ランキングで使う表紙をまとめて取得
  const need = articleWorkIds(o);
  const briefs = need.length ? await fetchWorkBriefs(need) : {};
  const covers: Record<number, string> = {};
  for (const [id, b] of Object.entries(briefs)) covers[Number(id)] = b.cover;
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
      <section className="mt-2 overflow-hidden rounded-2xl text-white" style={{ background: "linear-gradient(to bottom right, #3B3670, #C2772A)" }}>
        {o.heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={o.heroImage} alt={o.title} className="h-40 w-full object-cover" />
        ) : o.thumb ? (
          <OsusumeThumb
            spec={o.thumb}
            images={(o.thumb.workIds ?? []).map((id) => covers[id]).filter(Boolean)}
            className="h-40 w-full"
          />
        ) : null}
        <div className="p-4">
          <h1 className="text-xl font-extrabold leading-snug">{o.title}</h1>
          {o.updatedAt && <p className="mt-1 text-[11px] text-white/70">更新：{o.updatedAt}</p>}
          {o.intro && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/90">{o.intro}</p>}
        </div>
      </section>

      {/* 目次：どんな内容か一目で分かり、読みたい所へ飛べる */}
      {o.body && o.body.length > 2 && (
        <nav className="mt-5 rounded-2xl border border-[#ECECF2] bg-white p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-extrabold text-[#1C1C2E]">
            <span className="inline-block h-4 w-1 rounded-full bg-[#C2772A]" />
            この記事の内容
          </p>
          <ol className="mt-2.5 space-y-1.5">
            {tocOf(o).map((t, i) => (
              <li key={t.id} className="flex gap-2">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#F6E9D5] text-[10px] font-black text-[#8A5518]">
                  {i + 1}
                </span>
                <a href={`#${t.id}`} className="text-[13px] leading-snug text-[#374151] hover:text-[#C2772A] hover:underline">
                  {t.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* 解説本文（見出し＋段落）。読み物系の記事で使う */}
      {o.body && o.body.length > 0 && (
        <article className="mt-6 space-y-7">
          {o.body.map((s, i) => (
            <section key={i} id={`sec-${i}`} className="scroll-mt-4">
              <h2 className="flex items-start gap-2 rounded-xl bg-gradient-to-r from-[#F6E9D5] to-transparent py-2 pl-2.5 pr-3 text-base font-extrabold leading-snug text-[#1C1C2E]">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#C2772A] text-[10px] font-black text-white">
                  {i + 1}
                </span>
                {s.heading}
              </h2>

              {s.text && (
                <div className="mt-2.5 space-y-3">
                  {s.text.split("\n\n").map((p, j) => (
                    <p key={j} className="whitespace-pre-line text-[14px] leading-[1.9] text-[#374151]">
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
                      className="rounded-2xl border border-[#ECECF2] bg-white p-3 text-center"
                      style={{ borderTopColor: it.color || "#C2772A", borderTopWidth: 3 }}
                    >
                      <p className="text-[20px] font-black leading-tight" style={{ color: it.color || "#C2772A" }}>
                        {it.value}
                      </p>
                      <p className="mt-0.5 text-[11px] font-bold text-[#1C1C2E]">{it.label}</p>
                      {it.note && <p className="mt-0.5 text-[10px] text-[#6B7280]">{it.note}</p>}
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
                        <li key={j} className="flex gap-1.5 text-[12px] leading-snug text-[#374151]">
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
                        <li key={j} className="flex gap-1.5 text-[12px] leading-snug text-[#374151]">
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
                    <p className="whitespace-pre-line text-[13px] leading-relaxed text-[#374151]">
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
                            <span className="mt-1 line-clamp-2 block text-[11px] font-bold leading-snug text-[#1C1C2E]">
                              {b.title}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {s.works.note && (
                    <p className="mt-2 text-[11px] text-[#6B7280]">{s.works.note}</p>
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
                    <p className="text-[13px] font-extrabold text-[#1C1C2E]">{s.callout.title}</p>
                  )}
                  <p className="mt-0.5 whitespace-pre-line text-[13px] leading-relaxed text-[#374151]">
                    {s.callout.text}
                  </p>
                </div>
              )}

              {/* 横棒グラフ（カバー率などの比較） */}
              {s.bars && (
                <div className="mt-3 rounded-2xl border border-[#ECECF2] bg-white p-4">
                  <div className="space-y-2.5">
                    {s.bars.items.map((b, j) => {
                      const max = b.max ?? Math.max(...s.bars!.items.map((x) => x.value));
                      const pct = max > 0 ? Math.round((b.value / max) * 100) : 0;
                      return (
                        <div key={j} className="flex items-center gap-2">
                          <span className="w-28 flex-none text-[12px] font-bold text-[#1C1C2E]">{b.label}</span>
                          <span className="h-4 flex-1 overflow-hidden rounded-full bg-[#F1F1F5]">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${pct}%`, background: b.color || "#C2772A" }}
                            />
                          </span>
                          <span className="w-16 flex-none text-right text-[12px] font-bold text-[#1C1C2E]">
                            {b.value}
                            {b.suffix ?? ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {s.bars.note && <p className="mt-2.5 text-[11px] text-[#6B7280]">{s.bars.note}</p>}
                </div>
              )}

              {/* 比較表 */}
              {s.table && (
                <div className="mt-3">
                  <div className="overflow-x-auto rounded-2xl border border-[#ECECF2]">
                    <table className="w-full border-collapse bg-white text-[13px]">
                      <thead>
                        <tr className="bg-[#FBF3E6]">
                          {s.table.head.map((h, j) => (
                            <th
                              key={j}
                              className="whitespace-nowrap border-b border-[#ECECF2] px-3 py-2 text-left font-bold text-[#8A5518]"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {s.table.rows.map((r, j) => (
                          <tr key={j} className="border-b border-[#F1F1F5] last:border-0">
                            {r.map((c, k) => (
                              <td
                                key={k}
                                className={`px-3 py-2 align-top ${k === 0 ? "font-bold text-[#1C1C2E]" : "text-[#374151]"}`}
                              >
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {s.table.note && <p className="mt-2 text-[11px] text-[#6B7280]">{s.table.note}</p>}
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
                    <Link href={`/work/${e.workId}`} className="text-[15px] font-extrabold text-[#1C1C2E] hover:text-[#C2772A]">
                      {e.title}
                    </Link>
                  ) : (
                    <p className="text-[15px] font-extrabold text-[#1C1C2E]">{e.title}</p>
                  )}
                  {e.reviewTitle && <p className="mt-1 text-[13px] font-bold text-[#C2772A]">{e.reviewTitle}</p>}
                  {e.reviewBody && (
                    <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-[#374151]">{e.reviewBody}</p>
                  )}
                </div>
              </div>

              {((e.streaming && e.streaming.length > 0) || e.workId) && (
                <div className="flex flex-wrap items-center gap-2 border-t border-[#F1F1F5] px-3 py-2">
                  {e.streaming?.map((s) => (
                    <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#F6E9D5] px-3 py-1 text-[11px] font-bold text-[#C2772A]">
                      {s.name}で見る ↗
                    </a>
                  ))}
                  {e.workId && (
                    <Link href={`/work/${e.workId}`} className="ml-auto rounded-full bg-[#C2772A] px-3 py-1 text-[11px] font-bold text-white">
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
      <section className="mt-6 rounded-2xl border border-[#F6E9D5] bg-[#FBF3E6] p-4 text-center">
        <p className="text-sm font-bold text-[#1C1C2E]">気になった作品は「＋登録」で新着通知！</p>
        <p className="mt-1 text-xs text-[#6B7280]">新話の放送・配信入りを自動でお知らせします。</p>
        <Link href="/" className="mt-3 inline-block rounded-full bg-[#C2772A] px-5 py-2 text-sm font-bold text-white">
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
                <Link href={`/osusume/${x.slug}`} className="block rounded-xl border border-[#ECECF2] bg-white px-3 py-2 text-sm font-bold text-[#1C1C2E] hover:text-[#C2772A]">
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
