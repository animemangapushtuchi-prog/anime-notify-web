// トップページ（サーバー側で描画）。
// 以前はページ全体がクライアント部品だったため、クローラーやSNSには「読み込み中…」しか
// 届いていなかった。ここをサーバー描画にして、未ログインでも必ず中身があるようにする。
// ログイン状態に依存するマイリストだけ <MyListHome /> に切り出してある。
//
// 2026-10 デザイン刷新：コンセプトは「夜のアニメを見張るミーアキャット」。
// 見出しは夜空、下の帯は今夜の放送（実データ）。以降は紙の背景に雑誌のような節を並べる。
import Link from "next/link";
import type { Metadata } from "next";
import MyListHome from "@/components/MyListHome";
import WorkCard from "@/components/WorkCard";
import OsusumeThumb from "@/components/OsusumeThumb";
import Mascot from "@/components/Mascot";
import ServiceIcon from "@/components/ServiceIcon";
import SectionHead from "@/components/SectionHead";
import Hero from "@/components/home/Hero";
import { fetchSeasonPopular, fetchCovers } from "@/lib/anilist";
import { listOsusume, thumbWorkIds } from "@/lib/osusume";
import { latestSeasonKeyWithData, getPublishedEntries } from "@/lib/seasonStreaming";
import { seasonInfo } from "@/lib/season";
import { serviceNameOf, STREAM_SERVICES } from "@/lib/streaming";
import { getTonight, lateNightTime, todayIndexMon, type Tonight } from "@/lib/tonight";
import { OG_IMAGE } from "@/lib/seo";

// ISR：1時間ごとに再生成
export const revalidate = 3600;

const TITLE = "アニミル！（Animiru）｜アニメの放送・配信を自動で新着通知";
const DESC =
  "登録した作品の新話放送・配信入りを自動でお知らせ。放送カレンダー・今期アニメ・おすすめ特集も。アニメ好きのための新着通知サービス「アニミル！」。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/" },
  openGraph: { title: TITLE, description: DESC, url: "/", type: "website", images: [OG_IMAGE] },
};

const WRAP = "mx-auto max-w-2xl px-4 lg:max-w-[1400px] lg:px-8";
const SEASON_EN: Record<string, string> = { winter: "Winter", spring: "Spring", summer: "Summer", fall: "Fall" };

export default async function HomePage() {
  // 外部データはどれも「取れなければその節を出さない」方針。トップが落ちないようにする。
  const [popular, seasonKey] = await Promise.all([
    fetchSeasonPopular().catch((err) => {
      // 黙って消すと「今期の注目アニメが出ない理由」が分からなくなるので記録する
      console.error("[home] 今期人気作の取得に失敗しました", err);
      return [];
    }),
    latestSeasonKeyWithData().catch(() => ""),
  ]);
  const [entries, tonight] = await Promise.all([
    seasonKey ? getPublishedEntries(seasonKey).catch(() => []) : Promise.resolve([]),
    getTonight(popular).catch((): Tonight => ({ label: "今夜", dateLabel: "", items: [] })),
  ]);
  const season = seasonKey ? seasonInfo(seasonKey) : null;
  // サービスごとの作品数（確認済みの配信データから数える）
  const countBy = new Map<string, Set<number>>();
  for (const e of entries) {
    if (!countBy.has(e.serviceKey)) countBy.set(e.serviceKey, new Set());
    countBy.get(e.serviceKey)!.add(e.anilistId);
  }
  const services = STREAM_SERVICES.filter((s) => countBy.has(s.key))
    .map((s) => ({ key: s.key, name: serviceNameOf(s.key), count: countBy.get(s.key)!.size }))
    .sort((a, b) => b.count - a.count);
  const totalWorks = new Set(entries.map((e) => e.anilistId)).size;

  const articles = listOsusume().slice(0, 5);
  const covers = await fetchCovers(thumbWorkIds(articles)).catch(
    () => ({} as Record<number, string>)
  );
  const sample = tonight.items.find((i) => i.workId) ?? tonight.items[0];
  // カレンダーの絵で「今日」を光らせる（月曜はじまり。JST）
  const todayIdx = todayIndexMon();
  const seasonEn = season ? `${SEASON_EN[season.key.split("-")[1]] ?? ""} ${season.key.split("-")[0]}` : "";

  return (
    <main className="pb-6">
      <Hero tonight={tonight} />

      {/* ログイン状態に応じたマイリスト／はじめ方（クライアント側） */}
      <MyListHome />

      {/* 今期の注目作品：作品ページへの入口。SEO上もここが主役 */}
      {popular.length > 0 && (
        <section className={`${WRAP} mt-16 lg:mt-24`}>
          <SectionHead
            eyebrow={`Trending · ${seasonEn || "This season"}`}
            title="今期の注目アニメ"
            desc="AniList の人気順です。作品を選ぶと、放送予定と「どこで見られるか」がまとまったページに移動します。"
            href="/search"
            linkLabel="作品をさがす"
          />
          <ol className="mt-7 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-6 lg:gap-x-5 lg:gap-y-8 2xl:grid-cols-8">
            {popular.slice(0, 24).map((a, i) => (
              <li key={a.id} className="reveal">
                <WorkCard
                  id={a.id}
                  title={a.title}
                  coverUrl={a.coverUrl}
                  format={a.format}
                  status={a.status}
                  rank={i + 1}
                />
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 配信サービス別の入口 */}
      {season && services.length > 0 && (
        <section className={`${WRAP} mt-16 lg:mt-24`}>
          <SectionHead
            eyebrow="Where to watch"
            title={`${season.label}を、配信サービスで探す`}
            desc={`確認済みの配信情報だけを掲載しています（${totalWorks}作品）。各作品の公式サイトの「放送・配信」ページをもとにしています。`}
            href={`/streaming/${season.key}`}
            linkLabel="全サービスの一覧"
          />
          <ul className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 lg:gap-3 xl:grid-cols-5">
            {services.map((s) => (
              <li key={s.key} className="reveal">
                <Link
                  href={`/streaming/${season.key}/${s.key}`}
                  className="group flex items-center gap-3 rounded-2xl border border-line bg-white px-3.5 py-3 transition hover:-translate-y-0.5 hover:border-amber hover:shadow-[0_12px_30px_-18px_rgba(26,21,35,0.45)]"
                >
                  <ServiceIcon name={s.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-ink group-hover:text-amber-ink">{s.name}</span>
                    <span className="text-[11px] text-ink-2">
                      <span className="num text-sm font-bold text-ink">{s.count}</span> 作品
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* できること：通知・配信・カレンダー（画面のイメージつき） */}
      <section className={`${WRAP} mt-16 lg:mt-24`}>
        <SectionHead eyebrow="What Animiru does" title="アニミル！でできること" />
        <div className="mt-7 grid gap-3 lg:grid-cols-3 lg:gap-4">
          {/* 1. 放送の通知：通知の見本 */}
          <article className="reveal relative flex flex-col overflow-hidden rounded-3xl bg-night p-6 text-white lg:col-span-2 lg:row-span-2 lg:p-10">
            <div aria-hidden="true" className="starfield absolute inset-0 opacity-70" />
            <div className="relative flex flex-1 flex-col justify-between gap-8">
              <div>
                <p className="num text-xs font-bold tracking-[0.2em] text-bell">01</p>
                <h3 className="mt-2 text-2xl font-black leading-snug lg:text-3xl">
                  新しい話の放送を、
                  <br />
                  鈴を鳴らしてお知らせ。
                </h3>
                <p className="mt-3 text-sm leading-[1.9] text-white/70">
                  登録した作品に新しい話の放送予定が入ると、ブラウザのプッシュ通知でお知らせします。
                  見ている放送局だけに絞ることもできます。
                </p>
              </div>
              <div className="relative flex items-end gap-4 sm:gap-8">
                <div aria-hidden="true" className="relative hidden flex-none sm:block">
                  <div className="absolute -bottom-3 left-1/2 h-5 w-32 -translate-x-1/2 rounded-[50%] bg-night-3" />
                  <Mascot pose="device" h={170} className="relative" />
                </div>
              <div className="relative w-full max-w-md flex-1 pb-2" aria-label="通知の見本">
                <div className="absolute -inset-6 rounded-[32px] bg-[radial-gradient(closest-side,rgba(232,179,60,0.25),transparent)]" aria-hidden="true" />
                <div className="relative rounded-2xl bg-white/95 p-4 text-ink shadow-[0_24px_50px_-20px_rgba(0,0,0,0.6)] backdrop-blur">
                  <div className="flex items-center gap-2 text-[11px] text-ink-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/mascot/w/face.webp" alt="" className="h-5 w-5 rounded-md bg-amber-soft object-cover" />
                    <span className="font-bold text-ink">アニミル！</span>
                    <span>・ 今</span>
                  </div>
                  <p className="mt-2 text-sm font-bold leading-snug">
                    {sample ? `『${sample.title}』` : "『登録した作品』"}
                    {sample?.ep != null ? `第${sample.ep}話` : "の新しい話"}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-2">
                    {sample ? `${tonight.label} ${lateNightTime(sample.st)} から ${sample.ch} で放送` : "今夜 24:30 から放送"}
                  </p>
                </div>
                <div className="relative mx-4 -mt-1 h-3 rounded-b-2xl bg-white/40" aria-hidden="true" />
                <div className="relative mx-8 h-2.5 rounded-b-2xl bg-white/20" aria-hidden="true" />
                <p className="relative mt-3 text-right text-[10px] text-white/60">
                  {sample ? "今夜の実際の放送をもとにした表示例です" : "表示例"}
                </p>
              </div>
              </div>
            </div>
          </article>

          {/* 2. 配信入り */}
          <article className="reveal rounded-3xl border border-line bg-white p-6 lg:p-7">
            <p className="num text-xs font-bold tracking-[0.2em] text-amber-ink">02</p>
            <h3 className="mt-2 text-xl font-black leading-snug">配信サービスに入ったら、お知らせ</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              dアニメストア・ABEMA・U-NEXT・Netflix などに作品が入ったタイミングを追いかけます。
            </p>
            <div className="mt-5 flex -space-x-1.5" aria-hidden="true">
              {["dアニメストア", "ABEMA", "U-NEXT", "Netflix", "Prime Video", "Disney+"].map((n) => (
                <span key={n} className="rounded-[9px] ring-2 ring-white">
                  <ServiceIcon name={n} size={30} />
                </span>
              ))}
            </div>
          </article>

          {/* 3. カレンダー */}
          <article className="reveal rounded-3xl border border-line bg-white p-6 lg:p-7">
            <p className="num text-xs font-bold tracking-[0.2em] text-amber-ink">03</p>
            <h3 className="mt-2 text-xl font-black leading-snug">1週間の放送を、カレンダーで</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              登録した作品の放送予定を1週間分まとめて見られます。今日の放送も一目で分かります。
            </p>
            <div className="mt-5 grid grid-cols-7 gap-1" aria-hidden="true">
              {["月", "火", "水", "木", "金", "土", "日"].map((d, i) => (
                <div key={d} className={`rounded-lg py-1.5 text-center ${i === todayIdx ? "bg-amber-deep text-white" : "bg-paper-2 text-ink-2"}`}>
                  <span className="block text-[10px] font-bold">{d}</span>
                  <span className="mt-1 flex justify-center gap-0.5">
                    {Array.from({ length: [2, 1, 3, 2, 1, 3, 2][i] }).map((_, k) => (
                      <span key={k} className={`h-1 w-1 rounded-full ${i === todayIdx ? "bg-white" : "bg-amber"}`} />
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      {/* おすすめ記事：1本を大きく、残りを小さく */}
      {articles.length > 0 && (
        <section className={`${WRAP} mt-16 lg:mt-24`}>
          <SectionHead
            eyebrow="Features"
            title="特集・読みもの"
            desc="アニミル！の配信データと、各サービスの公式情報で確かめたことだけを書いています。"
            href="/osusume"
            linkLabel="すべての記事"
          />
          <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
            {articles.map((o, i) => {
              const big = i === 0;
              return (
                <li key={o.slug} className={`reveal ${big ? "sm:col-span-2 lg:row-span-2" : ""}`}>
                  <Link
                    href={`/osusume/${o.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-white transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgba(26,21,35,0.5)]"
                  >
                    <OsusumeThumb
                      spec={o.thumb ?? { label: o.title.slice(0, 12) }}
                      images={(o.thumb?.workIds ?? []).map((id) => covers[id]).filter(Boolean)}
                      className={big ? "h-56 w-full lg:h-72" : "h-28 w-full"}
                      size={big ? "lg" : "md"}
                    />
                    <div className={big ? "flex flex-1 flex-col p-6" : "flex flex-1 flex-col p-4"}>
                      <p className={`${big ? "text-xl lg:text-2xl" : "text-sm"} line-clamp-3 font-black leading-snug text-ink group-hover:text-amber-ink`}>
                        {o.title}
                      </p>
                      {o.description && (
                        <p className={`mt-2 ${big ? "line-clamp-3 text-sm" : "line-clamp-2 text-xs"} leading-relaxed text-ink-2`}>
                          {o.description}
                        </p>
                      )}
                      <span className="num mt-auto pt-3 text-[11px] text-ink-2">{o.updatedAt}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 締めの呼びかけ */}
      <section className={`${WRAP} mt-16 lg:mt-24`}>
        <div className="reveal grain relative overflow-hidden rounded-3xl bg-amber-soft px-6 py-10 sm:px-10 lg:flex lg:items-center lg:justify-between lg:px-14 lg:py-12">
          <div className="max-w-xl">
            <p className="num text-[11px] font-bold uppercase tracking-[0.22em] text-amber-ink">Start tonight</p>
            <h2 className="mt-2 text-[26px] font-black leading-snug text-ink lg:text-4xl">
              今夜から、見張りをはじめよう。
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              作品を選んで「通知登録」を押すだけ。メール登録をしなくても5作品まで使えます。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/search" className="rounded-full bg-amber-deep px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-amber-ink">
                作品をさがす
              </Link>
              <Link href="/guide" className="rounded-full border border-amber/40 bg-white/60 px-5 py-3 text-sm font-bold text-amber-ink transition hover:bg-white">
                使い方を見る
              </Link>
            </div>
          </div>
          <div className="pointer-events-none mt-8 flex justify-center lg:mt-0" aria-hidden="true">
            <Mascot pose="cheer" h={190} className="animate-float" />
          </div>
        </div>
      </section>
    </main>
  );
}
