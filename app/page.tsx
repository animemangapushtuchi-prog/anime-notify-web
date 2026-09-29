// トップページ（サーバー側で描画）。
// 以前はページ全体がクライアント部品だったため、クローラーやSNSには「読み込み中…」しか
// 届いていなかった。ここをサーバー描画にして、未ログインでも必ず中身があるようにする。
// ログイン状態に依存するマイリストだけ <MyListHome /> に切り出してある。
import Link from "next/link";
import type { Metadata } from "next";
import MyListHome from "@/components/MyListHome";
import WorkCard from "@/components/WorkCard";
import OsusumeThumb from "@/components/OsusumeThumb";
import Mascot from "@/components/Mascot";
import { fetchSeasonPopular, fetchCovers } from "@/lib/anilist";
import { listOsusume, thumbWorkIds } from "@/lib/osusume";
import { latestSeasonKeyWithData, getPublishedEntries } from "@/lib/seasonStreaming";
import { seasonInfo } from "@/lib/season";
import { serviceNameOf } from "@/lib/streaming";
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

const SECTION_TITLE = "text-lg font-extrabold text-[#1C1C2E]";
const WRAP = "mx-auto max-w-2xl px-4 lg:max-w-6xl lg:px-8";

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
  const entries = seasonKey ? await getPublishedEntries(seasonKey).catch(() => []) : [];
  const serviceKeys = [...new Set(entries.map((e) => e.serviceKey))];
  const season = seasonKey ? seasonInfo(seasonKey) : null;

  const articles = listOsusume().slice(0, 4);
  const covers = await fetchCovers(thumbWorkIds(articles)).catch(
    () => ({} as Record<number, string>)
  );

  return (
    <main className="py-5">
      {/* サイト全体の見出し。クローラーにもSNSにも必ずこの文字列が届く */}
      <div className={WRAP}>
        <h1 className="text-xl font-extrabold leading-snug text-[#1C1C2E] lg:text-2xl">
          アニメの放送・配信を、見逃さない
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-[#6B7280]">
          気になる作品を登録しておくと、新しい話の放送日と、配信サービスに入った日を
          アニミル！が自動でお知らせします。放送カレンダー・今期の配信一覧・特集記事は
          ログインなしで見られます。
        </p>
      </div>

      {/* ログイン状態に応じたマイリスト／はじめ方（クライアント側） */}
      <MyListHome />

      {/* サービスの説明。未ログインの訪問者に「何ができるか」を文章で残す */}
      <section className={`${WRAP} mt-10`}>
        <h2 className={SECTION_TITLE}>アニミル！でできること</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#ECECF2] bg-white p-4">
            <h3 className="text-sm font-extrabold text-[#1C1C2E]">新話の放送を通知</h3>
            <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">
              登録した作品に新しい話の放送予定が入ると、ブラウザのプッシュ通知でお知らせします。
              放送局の指定もできます。
            </p>
          </div>
          <div className="rounded-2xl border border-[#ECECF2] bg-white p-4">
            <h3 className="text-sm font-extrabold text-[#1C1C2E]">配信入りを通知</h3>
            <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">
              dアニメストア・ABEMA・U-NEXT・Netflix などに作品が入ったタイミングを追いかけて
              お知らせします。
            </p>
          </div>
          <div className="rounded-2xl border border-[#ECECF2] bg-white p-4">
            <h3 className="text-sm font-extrabold text-[#1C1C2E]">放送カレンダー</h3>
            <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">
              登録した作品の放送予定を1週間分のカレンダーで見られます。今日の放送も一目で分かります。
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#ECECF2] bg-white p-4">
          <Mascot pose="point" h={64} />
          <p className="text-xs leading-relaxed text-[#6B7280]">
            使い方がわからないときは
            <Link href="/guide" className="mx-1 font-bold text-[#8A5518] underline">
              使い方ガイド
            </Link>
            を見てください。登録なしで5作品まで試せます。
          </p>
        </div>
      </section>
      {/* 今期の注目作品：作品ページへの入口。SEO上もここが主役 */}
      {popular.length > 0 && (
        <section className={`${WRAP} mt-10`}>
          <div className="flex items-end justify-between">
            <h2 className={SECTION_TITLE}>今期の注目アニメ</h2>
            <Link href="/search" className="text-xs font-bold text-[#8A5518] hover:underline">
              もっと探す ›
            </Link>
          </div>
          <p className="mt-1 text-xs text-[#6B7280]">
            作品名をタップすると、放送予定と「どこで見られるか」がまとまったページに移動します。
          </p>
          <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {popular.slice(0, 24).map((a) => (
              <li key={a.id}>
                <WorkCard
                  id={a.id}
                  title={a.title}
                  coverUrl={a.coverUrl}
                  format={a.format}
                  status={a.status}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 配信サービス別の入口 */}
      {season && serviceKeys.length > 0 && (
        <section className={`${WRAP} mt-10`}>
          <h2 className={SECTION_TITLE}>{season.label}を配信サービスで探す</h2>
          <p className="mt-1 text-xs text-[#6B7280]">
            確認済みの配信情報だけを掲載しています。
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            <li>
              <Link
                href={`/streaming/${season.key}`}
                className="inline-block rounded-full bg-[#A8621F] px-4 py-1.5 text-xs font-bold text-white"
              >
                {season.label} 一覧
              </Link>
            </li>
            {serviceKeys.map((key) => (
              <li key={key}>
                <Link
                  href={`/streaming/${season.key}/${key}`}
                  className="inline-block rounded-full border border-[#ECECF2] bg-white px-4 py-1.5 text-xs font-bold text-[#8A5518]"
                >
                  {serviceNameOf(key)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* おすすめ記事 */}
      {articles.length > 0 && (
        <section className={`${WRAP} mt-10`}>
          <div className="flex items-end justify-between">
            <h2 className={SECTION_TITLE}>おすすめ・特集</h2>
            <Link href="/osusume" className="text-xs font-bold text-[#8A5518] hover:underline">
              すべて見る ›
            </Link>
          </div>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {articles.map((o) => (
              <li key={o.slug}>
                <Link
                  href={`/osusume/${o.slug}`}
                  className="block overflow-hidden rounded-2xl border border-[#ECECF2] bg-white"
                >
                  <OsusumeThumb
                    spec={o.thumb ?? { label: o.title.slice(0, 12) }}
                    images={(o.thumb?.workIds ?? []).map((id) => covers[id]).filter(Boolean)}
                    className="h-28 w-full"
                  />
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-extrabold text-[#1C1C2E]">{o.title}</p>
                    {o.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-[#6B7280]">{o.description}</p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

    </main>
  );
}
