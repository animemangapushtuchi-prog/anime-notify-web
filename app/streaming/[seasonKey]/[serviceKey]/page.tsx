import { cache } from "react";
import type { Metadata } from "next";
import { OG_IMAGE } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { servableSeason } from "@/lib/season";
import { STREAM_SERVICES, serviceNameOf } from "@/lib/streaming";
import { getPublishedEntries, getSeasonMeta } from "@/lib/seasonStreaming";
import prices from "@/content/service-prices.json";
import StreamingList from "@/components/StreamingList";
import Mascot from "@/components/Mascot";
import PageHeader from "@/components/PageHeader";
import ServiceIcon from "@/components/ServiceIcon";
import UpcomingStarts from "@/components/UpcomingStarts";
import AdSlot from "@/components/AdSlot";
import AffiliateLinks from "@/components/AffiliateLinks";

export const revalidate = 3600;

type Props = { params: Promise<{ seasonKey: string; serviceKey: string }> };

const isKnownService = (k: string) => STREAM_SERVICES.some((s) => s.key === k);
const PRICE = prices as Record<string, { monthly: number; plan: string; url: string; checkedAt: string } | undefined>;

// generateMetadata と本体で二重に読まないようにまとめる
const loadEntries = cache((key: string) => getPublishedEntries(key));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seasonKey, serviceKey } = await params;
  const info = servableSeason(seasonKey);
  if (!info || !isKnownService(serviceKey)) return { title: "今期アニメ配信一覧｜アニミル！" };
  const name = serviceNameOf(serviceKey);
  // そのサービスの確認済みデータが1件も無いときは、中身が空のページになるので
  // 検索結果には出さない（データを公開すれば自動で戻る）。
  const all = await loadEntries(info.key).catch(() => []);
  const count = all.filter((e) => e.serviceKey === serviceKey).length;
  const title = `${info.label} ${name}で配信されるアニメ一覧${count > 0 ? `（${count}作品）` : ""}｜アニミル！`;
  const price = PRICE[serviceKey];
  const description = `${info.label}に${name}で配信される${count > 0 ? `${count}作品` : "アニメ"}の一覧。開始日・更新曜日・見放題/無料などを掲載。${price ? `${name}の月額は${price.monthly.toLocaleString()}円（${price.plan}）。` : ""}`;
  return {
    title,
    description,
    alternates: { canonical: `/streaming/${info.key}/${serviceKey}` },
    openGraph: { title, description, url: `/streaming/${info.key}/${serviceKey}`, images: [OG_IMAGE] },
    // 作品がほとんど無いページ（このサービスで3作品未満、または季節全体で15作品未満）も検索に出さない
    ...(count < 3 || new Set(all.map((e) => e.anilistId)).size < 15 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ServiceStreamingPage({ params }: Props) {
  const { seasonKey, serviceKey } = await params;
  const info = servableSeason(seasonKey);
  if (!info || !isKnownService(serviceKey)) notFound();

  const name = serviceNameOf(serviceKey);
  const [all, meta] = await Promise.all([
    loadEntries(info.key),
    getSeasonMeta(info.key),
  ]);
  const entries = all.filter((e) => e.serviceKey === serviceKey);
  const seasonWorks = new Set(all.map((e) => e.anilistId)).size;
  const exclusive = entries.filter((e) => e.isExclusive).length;
  const fastest = entries.filter((e) => e.isFastest).length;
  const included = entries.filter((e) => e.availability === "included").length;
  const price = PRICE[serviceKey];

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
        desc={
          <>
            {entries.length > 0 && (
              <p>
                アニミル！が確認した{info.label}{seasonWorks}作品のうち、{name}で配信されるのは{entries.length}作品です。
                {[included > 0 && `見放題${included}作品`, exclusive > 0 && `独占${exclusive}作品`, fastest > 0 && `最速配信${fastest}作品`].filter(Boolean).join("・")}
                {included + exclusive + fastest > 0 ? "を含みます。" : ""}
              </p>
            )}
            {price && (
              <p className="mt-1">
                月額 <strong className="text-ink">{price.monthly.toLocaleString()}円</strong>（{price.plan}。
                <a href={price.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{price.checkedAt.replaceAll("-", "/")}確認</a>）
              </p>
            )}
            <p className="mt-1 text-xs">確認済みの情報を掲載しています。配信状況は変更される場合があります。</p>
          </>
        }
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
          <Link
            href="/streaming/planner"
            className="ml-2 inline-flex rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-bold text-amber-ink transition hover:border-amber"
          >
            見たい作品からサブスク診断 ›
          </Link>
        </div>
      </PageHeader>

      <UpcomingStarts entries={entries} showService={false} />

      {entries.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-line bg-white p-10 text-center text-sm text-ink-2">
          <Mascot pose="worried" h={110} />
          <p>現在、{name}で確認できている作品はありません。</p>
        </div>
      ) : (
        // カードにはその作品の全サービスを出し、このサービスを強調する（作品はこのサービスがあるものだけ）
        <StreamingList entries={all.filter((e) => entries.some((x) => x.anilistId === e.anilistId))} lockedServiceKey={serviceKey} />
      )}

      {/* このサービスの紹介リンク（PR）。content/ads.json に登録が無ければ何も出ない */}
      {entries.length > 0 && <AffiliateLinks serviceKeys={[serviceKey]} className="mt-8" />}
      <AdSlot name="streaming" className="mt-8" />

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
