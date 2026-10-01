import { cache } from "react";
import type { Metadata } from "next";
import { OG_IMAGE } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { parseSeasonKey } from "@/lib/season";
import { STREAM_SERVICES, serviceNameOf } from "@/lib/streaming";
import { getPublishedEntries, getSeasonMeta } from "@/lib/seasonStreaming";
import StreamingList from "@/components/StreamingList";
import Mascot from "@/components/Mascot";
import PageHeader from "@/components/PageHeader";
import ServiceIcon from "@/components/ServiceIcon";

export const revalidate = 3600;

type Props = { params: Promise<{ seasonKey: string; serviceKey: string }> };

const isKnownService = (k: string) => STREAM_SERVICES.some((s) => s.key === k);

// generateMetadata と本体で二重に読まないようにまとめる
const loadEntries = cache((key: string) => getPublishedEntries(key));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seasonKey, serviceKey } = await params;
  const info = parseSeasonKey(seasonKey);
  if (!info || !isKnownService(serviceKey)) return { title: "今期アニメ配信一覧｜アニミル！" };
  const name = serviceNameOf(serviceKey);
  const title = `${info.label} ${name}で配信されるアニメ一覧｜アニミル！`;
  const description = `${info.label}に${name}で配信される（確認済み）アニメの一覧。開始日・更新曜日・見放題/無料などを掲載。`;
  // そのサービスの確認済みデータが1件も無いときは、中身が空のページになるので
  // 検索結果には出さない（データを公開すれば自動で戻る）。
  const all = await loadEntries(info.key).catch(() => []);
  const count = all.filter((e) => e.serviceKey === serviceKey).length;
  return {
    title,
    description,
    alternates: { canonical: `/streaming/${info.key}/${serviceKey}` },
    openGraph: { title, description, url: `/streaming/${info.key}/${serviceKey}`, images: [OG_IMAGE] },
    ...(count === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ServiceStreamingPage({ params }: Props) {
  const { seasonKey, serviceKey } = await params;
  const info = parseSeasonKey(seasonKey);
  if (!info || !isKnownService(serviceKey)) notFound();

  const name = serviceNameOf(serviceKey);
  const [all, meta] = await Promise.all([
    loadEntries(info.key),
    getSeasonMeta(info.key),
  ]);
  const entries = all.filter((e) => e.serviceKey === serviceKey);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-6 lg:max-w-[1400px] lg:px-8">
      <PageHeader
        crumbs={[
          { href: "/streaming", label: "今期配信" },
          { href: `/streaming/${info.key}`, label: info.label },
          { label: name },
        ]}
        eyebrow={info.label}
        title={
          <span className="flex items-center gap-3">
            <ServiceIcon name={name} size={40} />
            <span>{name}で配信されるアニメ</span>
          </span>
        }
        desc={<p>確認済みの情報を掲載しています。配信状況は変更される場合があります。</p>}
        aside={
          entries.length > 0 ? (
            <div className="rounded-2xl border border-line bg-white px-5 py-3">
              <p className="text-[11px] text-ink-2">作品</p>
              <p className="num text-2xl font-bold text-ink">{entries.length}</p>
            </div>
          ) : null
        }
      >
        {serviceKey === "prime-video" && entries.length > 0 && (
          <p className="mt-5 rounded-2xl border border-amber-soft bg-amber-wash px-4 py-3 text-xs leading-relaxed text-ink">
            Prime Videoには、会員なら追加料金なしで見られる「見放題」と、1話ごとに料金がかかる「レンタル・購入」があります。
            「見放題」「レンタル」の表示が無い作品は、公式サイトにどちらか書かれていなかったものです。
            見る前にPrime Videoで作品名を検索して確認してください。
          </p>
        )}
        <div className="mt-5">
          <Link
            href={`/streaming/${info.key}`}
            className="inline-flex rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-bold text-amber-ink transition hover:border-amber"
          >
            ← {info.label} の全サービス一覧へ
          </Link>
        </div>
      </PageHeader>

      {entries.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-line bg-white p-10 text-center text-sm text-ink-2">
          <Mascot pose="worried" h={110} />
          <p>現在、{name}で確認できている作品はありません。</p>
        </div>
      ) : (
        <StreamingList entries={entries} lockedServiceKey={serviceKey} />
      )}

      <p className="mt-8 text-[11px] text-ink-2">
        出典：各作品の公式サイト・{name}公式・AniList
        {meta?.lastPublishedAt ? `（最終確認日 ${jstDate(meta.lastPublishedAt)}）` : ""}
      </p>
    </main>
  );
}

function jstDate(sec: number): string {
  const d = new Date(sec * 1000 + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}
