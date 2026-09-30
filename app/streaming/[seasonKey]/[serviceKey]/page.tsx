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
    <main className="mx-auto max-w-2xl px-4 py-5 lg:max-w-6xl lg:px-8">
      <nav className="text-[11px] text-[#6B7280]">
        <Link href="/streaming" className="hover:underline">今期配信</Link>
        <span className="mx-1">›</span>
        <Link href={`/streaming/${info.key}`} className="hover:underline">{info.label}</Link>
        <span className="mx-1">›</span>
        <span className="text-[#1C1C2E]">{name}</span>
      </nav>

      <h1 className="mt-2 text-xl font-extrabold text-[#1C1C2E]">
        {info.label} {name}で配信されるアニメ
      </h1>
      <p className="mt-1 text-[11px] text-black/40">
        確認済みの情報を掲載しています。配信状況は変更される場合があります。
      </p>
      {serviceKey === "prime-video" && entries.length > 0 && (
        <p className="mt-3 rounded-xl border border-[#F6E9D5] bg-[#FBF3E6] px-3 py-2 text-xs leading-relaxed text-[#1C1C2E]">
          Prime Videoには、会員なら追加料金なしで見られる「見放題」と、1話ごとに料金がかかる「レンタル・購入」があります。
          「見放題」「レンタル」の表示が無い作品は、公式サイトにどちらか書かれていなかったものです。
          見る前にPrime Videoで作品名を検索して確認してください。
        </p>
      )}

      <div className="mt-3">
        <Link href={`/streaming/${info.key}`} className="text-xs font-bold text-[#8A5518] hover:underline">
          ← {info.label} の全サービス一覧へ
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-[#ECECF2] bg-white p-8 text-center text-sm text-black/50">
          <Mascot pose="worried" h={110} />
          <p>現在、{name}で確認できている作品はありません。</p>
        </div>
      ) : (
        <StreamingList entries={entries} lockedServiceKey={serviceKey} />
      )}

      <p className="mt-8 text-[10px] text-black/40">出典：各作品の公式サイト・{name}公式・AniList</p>
      {meta?.lastPublishedAt ? null : null}
    </main>
  );
}
