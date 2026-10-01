import { cache } from "react";
import type { Metadata } from "next";
import { OG_IMAGE } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  parseSeasonKey,
  adjacentSeasonKey,
} from "@/lib/season";
import { getPublishedEntries, getSeasonMeta } from "@/lib/seasonStreaming";
import StreamingList from "@/components/StreamingList";
import Mascot from "@/components/Mascot";
import PageHeader from "@/components/PageHeader";

export const revalidate = 3600;

type Props = { params: Promise<{ seasonKey: string }> };

// generateMetadata と本体で二重に読まないようにまとめる
const loadEntries = cache((key: string) => getPublishedEntries(key));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seasonKey } = await params;
  const info = parseSeasonKey(seasonKey);
  if (!info) return { title: "今期アニメ配信一覧｜アニミル！" };
  const title = `${info.label}の配信一覧｜Prime Video・Netflix・ABEMA・dアニメ｜アニミル！`;
  const description = `${info.label}を配信サービス別に比較。Prime Video、Netflix、ABEMA、dアニメストアなどの確認済み配信作品、開始日、更新曜日を掲載。`;
  // まだデータを入れていないシーズンは、中身が空のまま200を返してしまう。
  // 薄いページとして扱われないよう検索結果には出さない（公開すれば自動で戻る）。
  const entries = await loadEntries(info.key).catch(() => []);
  return {
    title,
    description,
    alternates: { canonical: `/streaming/${info.key}` },
    openGraph: { title, description, url: `/streaming/${info.key}`, images: [OG_IMAGE] },
    ...(entries.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

function jstDate(sec: number): string {
  const d = new Date(sec * 1000 + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export default async function SeasonStreamingPage({ params }: Props) {
  const { seasonKey } = await params;
  const info = parseSeasonKey(seasonKey);
  if (!info) notFound();

  const [entries, meta] = await Promise.all([
    loadEntries(info.key),
    getSeasonMeta(info.key),
  ]);
  const prev = parseSeasonKey(adjacentSeasonKey(info.key, -1))!;
  const next = parseSeasonKey(adjacentSeasonKey(info.key, 1))!;

  const works = new Set(entries.map((e) => e.anilistId)).size;
  const services = new Set(entries.map((e) => e.serviceKey)).size;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-6 lg:max-w-[1400px] lg:px-8">
      <PageHeader
        crumbs={[{ href: "/", label: "ホーム" }, { href: "/streaming", label: "今期配信" }, { label: info.label }]}
        eyebrow="Where to watch"
        title={<>{info.label}<br className="sm:hidden" /> 配信サービス別一覧</>}
        desc={
          <>
            <p>Prime Video・Netflix・ABEMA・dアニメストアなどを横断して比較できます。</p>
            <p className="mt-1 text-xs">
              各作品の公式サイトで確認できた情報だけを掲載しています。配信状況は変更される場合があります。
              {meta?.lastPublishedAt ? `（最終確認日 ${jstDate(meta.lastPublishedAt)}）` : ""}
            </p>
          </>
        }
        aside={
          entries.length > 0 ? (
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
        <nav aria-label="シーズン" className="mt-5 flex items-center justify-between gap-2 text-xs font-bold">
          <Link href={`/streaming/${prev.key}`} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-amber-ink transition hover:border-amber">← {prev.label}</Link>
          <Link href={`/streaming/${next.key}`} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-amber-ink transition hover:border-amber">{next.label} →</Link>
        </nav>
      </PageHeader>

      {entries.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-line bg-white p-10 text-center text-sm text-ink-2">
          <Mascot pose="sit" h={120} />
          <p>このシーズンの配信情報は現在確認中です。確認でき次第、順次掲載します。</p>
        </div>
      ) : (
        <StreamingList entries={entries} />
      )}

      <p className="mt-8 text-[11px] text-ink-2">出典：各作品の公式サイト・各配信サービス公式・AniList</p>
    </main>
  );
}
