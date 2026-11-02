import type { Metadata } from "next";
import Link from "next/link";
import prices from "@/content/service-prices.json";
import { OG_IMAGE } from "@/lib/seo";
import { fetchSeasonPopular } from "@/lib/anilist";
import { getPublishedEntries, latestSeasonKeyWithData, type PublicEntry } from "@/lib/seasonStreaming";
import { seasonInfo } from "@/lib/season";
import { serviceNameOf } from "@/lib/streaming";
import { bestBySize, cheapestPlan, coverage, type PlanWork, type Prices } from "@/lib/planner";
import PageHeader from "@/components/PageHeader";
import Planner from "@/components/Planner";
import ServiceIcon from "@/components/ServiceIcon";

export const revalidate = 3600;

const SITE = "https://www.animiru.com";
const PATH = "/streaming/planner";
const TITLE = "アニメのサブスク診断｜見たい作品から一番安い組み合わせを計算｜アニミル！";
const DESC =
  "今期アニメの見たい作品を選ぶと、全部見るのに必要な配信サービスと月額の合計を計算します。U-NEXT・dアニメストア・ABEMA・Netflix・Prime Video など、確認済みの配信データと公式の料金で比較できます。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: PATH },
  openGraph: { title: TITLE, description: DESC, url: PATH, images: [OG_IMAGE] },
};

type PriceInfo = { monthly: number; plan: string; url: string; checkedAt: string };
const PRICE = prices as Record<string, PriceInfo>;
const MONTHLY: Prices = Object.fromEntries(Object.entries(PRICE).map(([k, v]) => [k, v.monthly]));

// 月額に含まれない行（レンタル・追加チャンネル）は数えない
function toWorks(entries: PublicEntry[], order: Map<number, number>): PlanWork[] {
  const map = new Map<number, PlanWork>();
  for (const e of entries) {
    const w = map.get(e.anilistId) ?? { id: e.anilistId, title: e.title, cover: e.coverImage, services: [] };
    if (e.availability !== "rental" && e.availability !== "channel") w.services.push(e.serviceKey);
    if (!w.cover) w.cover = e.coverImage;
    map.set(e.anilistId, w);
  }
  // AniList の人気順に並べる。順位が無い作品は後ろへ
  return [...map.values()].sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
}

const yen = (n: number) => `${n.toLocaleString()}円`;
const names = (keys: string[]) => keys.map(serviceNameOf).join("＋");

export default async function PlannerPage() {
  const seasonKey = await latestSeasonKeyWithData().catch(() => "");
  const [entries, popular] = await Promise.all([
    seasonKey ? getPublishedEntries(seasonKey).catch(() => []) : Promise.resolve([] as PublicEntry[]),
    fetchSeasonPopular().catch(() => []),
  ]);
  const season = seasonInfo(seasonKey);
  const works = toWorks(entries, new Map(popular.map((a, i) => [a.id, i])));
  const all = cheapestPlan(works, MONTHLY);
  const bests = [1, 2, 3].map((n) => bestBySize(works, MONTHLY, n)).filter((p) => p != null);
  const rows = Object.entries(PRICE)
    .map(([key, p]) => ({ key, ...p, count: coverage(works, key) }))
    .sort((a, b) => a.monthly - b.monthly);

  const faq = bests[0]
    ? [
        {
          q: `${season.label}をいちばん多く見られるサービスはどこですか？`,
          a: `アニミル！が確認した${works.length}作品のうち、1社でいちばん多いのは${names(bests[0].services)}の${bests[0].covered}作品です（月額${yen(bests[0].total)}）。`,
        },
        ...(bests[1]
          ? [{ q: "2社を組み合わせるならどれがいいですか？", a: `見られる作品がいちばん多いのは${names(bests[1].services)}で${bests[1].covered}作品、月額の合計は${yen(bests[1].total)}です。` }]
          : []),
        {
          q: `${season.label}を全部見るにはいくらかかりますか？`,
          a: `確認済みの配信先で見られる${all.covered}作品をすべて見る、いちばん安い組み合わせは${names(all.services)}で、月額の合計は${yen(all.total)}です。`,
        },
      ]
    : [];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "アニメのサブスク診断",
      url: `${SITE}${PATH}`,
      applicationCategory: "EntertainmentApplication",
      operatingSystem: "Web",
      inLanguage: "ja",
      offers: { "@type": "Offer", price: 0, priceCurrency: "JPY" },
    },
    ...(faq.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
        ]
      : []),
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 pb-6 lg:max-w-[1180px] lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageHeader
        crumbs={[{ href: "/", label: "ホーム" }, { href: "/streaming", label: "今期配信" }, { label: "サブスク診断" }]}
        eyebrow="Subscription planner"
        title={<>見たい作品から選ぶ<br className="sm:hidden" /> サブスク診断</>}
        desc={
          <p>
            {season.label}の見たい作品を選ぶと、全部見るのにいちばん安い配信サービスの組み合わせと、月額の合計を計算します。
            配信先はアニミル！が確認した情報、料金は各社の公式サイトで確かめた金額です。
          </p>
        }
      />

      <Planner works={works} prices={MONTHLY} />

      {bests.length > 0 && (
        <section aria-labelledby="best-h" className="mt-12">
          <h2 id="best-h" className="text-xl font-black text-ink">{season.label}{works.length}作品で計算した結果</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {bests.map((p) => (
              <li key={p.services.join("+")} className="rounded-2xl border border-line bg-white p-4">
                <p className="text-[11px] font-bold text-ink-2">{p.services.length}社で最多</p>
                <p className="mt-1 text-sm font-black leading-snug text-ink">{names(p.services)}</p>
                <p className="mt-2 text-xs text-ink-2">
                  <span className="num text-lg font-black text-ink">{p.covered}</span> 作品・月額 <span className="num font-bold text-ink">{p.total.toLocaleString()}</span>円
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-2xl bg-amber-wash px-4 py-3 text-sm leading-relaxed text-ink">
            確認できている{all.covered}作品を全部見るなら、{names(all.services)}の組み合わせがいちばん安く、月額の合計は <strong>{yen(all.total)}</strong> です。
          </p>
        </section>
      )}

      <section aria-labelledby="price-h" className="mt-10">
        <h2 id="price-h" className="text-xl font-black text-ink">計算に使った月額料金</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full border-collapse bg-white text-[13px]">
            <thead>
              <tr className="bg-amber-wash text-left text-amber-ink">
                <th scope="col" className="whitespace-nowrap px-3 py-2">サービス</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2">月額（税込）</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2">{season.label}</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2">プラン</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2">確認日</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-line">
                  <td className="whitespace-nowrap px-3 py-2 font-bold text-ink">
                    <span className="flex items-center gap-2"><ServiceIcon name={serviceNameOf(r.key)} size={20} />{serviceNameOf(r.key)}</span>
                  </td>
                  <td className="num whitespace-nowrap px-3 py-2 text-ink">{yen(r.monthly)}</td>
                  <td className="num whitespace-nowrap px-3 py-2 text-ink">
                    {r.count > 0 ? <Link href={`/streaming/${season.key}/${r.key}`} className="text-amber-ink underline-offset-2 hover:underline">{r.count}作品</Link> : "—"}
                  </td>
                  <td className="px-3 py-2 text-ink-2">{r.plan}</td>
                  <td className="num whitespace-nowrap px-3 py-2 text-ink-2">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{r.checkedAt.replaceAll("-", "/")}</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-2 space-y-0.5 text-[11px] leading-relaxed text-ink-2">
          <li>アプリから登録すると高くなるサービスがあります。無料期間やキャンペーンは計算に入れていません。</li>
          <li>Netflix の広告つきプランでは見られない作品があります。Prime Video の「見放題」かどうかは作品ページで確かめてください。</li>
          <li>レンタルと追加チャンネルは月額に含まれないので数えていません。料金を確認できていないバンダイチャンネルなどは計算に入っていません。</li>
          <li>各社の料金は変わることがあります。契約する前に公式サイトを確かめてください。</li>
        </ul>
      </section>

      {faq.length > 0 && (
        <section aria-labelledby="faq-h" className="mt-10 rounded-3xl border border-line bg-white p-5">
          <h2 id="faq-h" className="text-[15px] font-black text-ink">よくある質問</h2>
          <dl className="mt-3 divide-y divide-line">
            {faq.map((f) => (
              <div key={f.q} className="py-3 first:pt-0 last:pb-0">
                <dt className="text-sm font-bold text-ink">{f.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-[#3A3342]">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-2 text-xs font-bold">
        <Link href={`/streaming/${season.key}`} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-amber-ink transition hover:border-amber">
          {season.label}の配信一覧 ›
        </Link>
        <Link href="/streaming/weekly" className="rounded-full border border-line bg-white px-3.5 py-1.5 text-amber-ink transition hover:border-amber">
          今週の放送・配信スケジュール ›
        </Link>
      </div>
    </main>
  );
}
