import { cache } from "react";
import type { Metadata } from "next";
import { OG_IMAGE } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  parseSeasonKey,
  servableSeason,
  adjacentSeasonKey,
} from "@/lib/season";
import { getPublishedEntries, getSeasonMeta } from "@/lib/seasonStreaming";
import { upcomingSeason } from "@/lib/upcoming";
import StreamingList from "@/components/StreamingList";
import UpcomingSeasonList from "@/components/UpcomingSeasonList";
import Mascot from "@/components/Mascot";
import PageHeader from "@/components/PageHeader";
import UpcomingStarts from "@/components/UpcomingStarts";
import AdSlot from "@/components/AdSlot";

export const revalidate = 3600;

type Props = { params: Promise<{ seasonKey: string }> };

// generateMetadata と本体で二重に読まないようにまとめる
const loadEntries = cache((key: string) => getPublishedEntries(key));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seasonKey } = await params;
  const info = servableSeason(seasonKey);
  if (!info) return { title: "今期アニメ配信一覧｜アニミル！" };
  // 来期は配信先の発表前の作品が多いので、放送日の一覧として見せる
  const upcoming = upcomingSeason(info.key);
  const title = upcoming
    ? `${info.label}一覧｜放送日・放送局・配信サービス｜アニミル！`
    : `${info.label}の配信一覧｜Prime Video・Netflix・ABEMA・dアニメ｜アニミル！`;
  const description = upcoming
    ? `${info.label}${upcoming.works.length}作品の放送開始日と放送局を、各作品の公式サイトで確認してまとめました。配信サービスは発表され次第、追加します。`
    : `${info.label}を配信サービス別に比較。Prime Video、Netflix、ABEMA、dアニメストアなどの確認済み配信作品、開始日、更新曜日を掲載。`;
  // まだデータを入れていないシーズンは、中身が空のまま200を返してしまう。
  // 薄いページとして扱われないよう検索結果には出さない（公開すれば自動で戻る）。
  const entries = await loadEntries(info.key).catch(() => []);
  return {
    title,
    description,
    alternates: { canonical: `/streaming/${info.key}` },
    openGraph: { title, description, url: `/streaming/${info.key}`, images: [OG_IMAGE] },
    // 作品が少ない季節（来期の発表が出始めたばかりなど）も、中身の薄いページになるので検索に出さない（15作品未満）
    ...(new Set([...entries.map((e) => e.anilistId), ...(upcoming?.works.map((w) => w.id) ?? [])]).size < 15
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}

function jstDate(sec: number): string {
  const d = new Date(sec * 1000 + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export default async function SeasonStreamingPage({ params }: Props) {
  const { seasonKey } = await params;
  const info = servableSeason(seasonKey);
  if (!info) notFound();

  const [entries, meta] = await Promise.all([
    loadEntries(info.key),
    getSeasonMeta(info.key),
  ]);
  // 「← 前」「次 →」は、公開データがある季節にだけ出す。
  // 以前は無条件に出していたため、Google が 1967年冬 まで季節ページをたどり続けていた（空のページが144件）
  const prev = parseSeasonKey(adjacentSeasonKey(info.key, -1))!;
  const next = parseSeasonKey(adjacentSeasonKey(info.key, 1))!;
  const [prevMeta, nextMeta] = await Promise.all([getSeasonMeta(prev.key), getSeasonMeta(next.key)]);
  const hasPrev = (prevMeta?.confirmedCount ?? 0) > 0;
  const hasNext = (nextMeta?.confirmedCount ?? 0) > 0;

  const upcoming = upcomingSeason(info.key);
  const works = new Set(entries.map((e) => e.anilistId)).size;
  const services = new Set(entries.map((e) => e.serviceKey)).size;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-6 lg:max-w-[1400px] lg:px-8">
      <PageHeader
        crumbs={[{ href: "/", label: "ホーム" }, { href: "/streaming", label: "今期配信" }, { label: info.label }]}
        eyebrow={upcoming ? "Coming soon" : "Where to watch"}
        title={upcoming ? <>{info.label}<br className="sm:hidden" /> 放送日一覧</> : <>{info.label}<br className="sm:hidden" /> 配信サービス別一覧</>}
        desc={
          upcoming ? (
            <>
              <p>{info.label}の放送開始日と放送局を、各作品の公式サイトで確かめて並べました。</p>
              <p className="mt-1 text-xs">
                配信サービスは、発表された作品にだけアイコンを付けています。続編の公式サイトに残っている前のシーズンの配信案内は使っていません。
                （確認日 {upcoming.checkedAt.replaceAll("-", "/")}）
              </p>
            </>
          ) : (
            <>
              <p>Prime Video・Netflix・ABEMA・dアニメストアなどを横断して比較できます。</p>
              <p className="mt-1 text-xs">
                各作品の公式サイトで確認できた情報だけを掲載しています。配信状況は変更される場合があります。
                {meta?.lastPublishedAt ? `（最終確認日 ${jstDate(meta.lastPublishedAt)}）` : ""}
              </p>
            </>
          )
        }
        aside={
          upcoming ? (
            <div className="rounded-2xl border border-line bg-white px-5 py-3">
              <p className="text-[11px] text-ink-2">作品</p>
              <p className="num text-2xl font-bold text-ink">{upcoming.works.length}</p>
            </div>
          ) : entries.length > 0 ? (
            <dl className="flex gap-6 rounded-2xl border border-line bg-white px-5 py-3">
              <div>
                <dt className="text-[11px] text-ink-2">作品</dt>
                <dd className="num text-2xl font-bold text-ink">{works}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-2">サービス</dt>
                <dd className="num text-2xl font-bold text-ink">{services}</dd>
              </div>
            </dl>
          ) : null
        }
      >
        <nav aria-label="シーズン" className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          {hasPrev ? (
            <Link href={`/streaming/${prev.key}`} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-amber-ink transition hover:border-amber">← {prev.label}</Link>
          ) : (
            <span />
          )}
          <Link href="/streaming/weekly" className="rounded-full bg-ink px-3.5 py-1.5 text-white transition hover:bg-night-2">今週の放送・配信スケジュール ›</Link>
          {hasNext ? (
            <Link href={`/streaming/${next.key}`} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-amber-ink transition hover:border-amber">{next.label} →</Link>
          ) : (
            <span />
          )}
        </nav>
      </PageHeader>

      {upcoming ? <UpcomingSeasonList data={upcoming} entries={entries} /> : <UpcomingStarts entries={entries} />}

      {upcoming ? null : entries.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-line bg-white p-10 text-center text-sm text-ink-2">
          <Mascot pose="sit" h={120} />
          <p>このシーズンの配信情報は現在確認中です。確認でき次第、順次掲載します。</p>
        </div>
      ) : (
        <StreamingList entries={entries} />
      )}

      <AdSlot name="streaming" className="mt-8" />

      <p className="mt-8 text-[11px] text-ink-2">出典：各作品の公式サイト・各配信サービス公式・AniList</p>
    </main>
  );
}
