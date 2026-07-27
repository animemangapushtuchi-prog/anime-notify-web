import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  parseSeasonKey,
  adjacentSeasonKey,
} from "@/lib/season";
import { getPublishedEntries, getSeasonMeta } from "@/lib/seasonStreaming";
import StreamingList from "@/components/StreamingList";
import Mascot from "@/components/Mascot";

export const revalidate = 3600;

type Props = { params: Promise<{ seasonKey: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seasonKey } = await params;
  const info = parseSeasonKey(seasonKey);
  if (!info) return { title: "今期アニメ配信一覧｜アニミル！" };
  const title = `${info.label}の配信一覧｜Prime Video・Netflix・ABEMA・dアニメ｜アニミル！`;
  const description = `${info.label}を配信サービス別に比較。Prime Video、Netflix、ABEMA、dアニメストアなどの確認済み配信作品、開始日、更新曜日を掲載。`;
  return {
    title,
    description,
    alternates: { canonical: `/streaming/${info.key}` },
    openGraph: { title, description, url: `/streaming/${info.key}` },
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
    getPublishedEntries(info.key),
    getSeasonMeta(info.key),
  ]);
  const prev = parseSeasonKey(adjacentSeasonKey(info.key, -1))!;
  const next = parseSeasonKey(adjacentSeasonKey(info.key, 1))!;

  return (
    <main className="mx-auto max-w-2xl px-4 py-5 lg:max-w-6xl lg:px-8">
      <nav className="text-[11px] text-[#6B7280]">
        <Link href="/" className="hover:underline">ホーム</Link>
        <span className="mx-1">›</span>
        <Link href="/streaming" className="hover:underline">今期配信</Link>
        <span className="mx-1">›</span>
        <span className="text-[#1C1C2E]">{info.label}</span>
      </nav>

      <h1 className="mt-2 text-xl font-extrabold text-[#1C1C2E]">
        {info.label} 配信サービス別一覧
      </h1>
      <p className="mt-1 text-sm text-[#6B7280]">
        Prime Video・Netflix・ABEMA・dアニメストアなどを横断比較
      </p>
      <p className="mt-1 text-[11px] text-black/40">
        確認済みの情報を掲載しています。配信状況は変更される場合があります。
        {meta?.lastPublishedAt ? `（最終確認日 ${jstDate(meta.lastPublishedAt)}）` : ""}
      </p>

      <div className="mt-3 flex items-center justify-between text-xs font-bold text-[#C2772A]">
        <Link href={`/streaming/${prev.key}`} className="hover:underline">← {prev.label}</Link>
        <Link href={`/streaming/${next.key}`} className="hover:underline">{next.label} →</Link>
      </div>

      {entries.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-[#ECECF2] bg-white p-8 text-center text-sm text-black/50">
          <Mascot pose="sit" h={120} />
          <p>このシーズンの配信情報は現在確認中です。確認でき次第、順次掲載します。</p>
        </div>
      ) : (
        <StreamingList entries={entries} />
      )}

      <p className="mt-8 text-[10px] text-black/40">出典：各配信サービス公式・AniList</p>
    </main>
  );
}
