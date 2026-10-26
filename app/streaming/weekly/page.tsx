import type { Metadata } from "next";
import Link from "next/link";
import { OG_IMAGE } from "@/lib/seo";
import { fetchSeasonPopular } from "@/lib/anilist";
import { latestSeasonKeyWithData, getPublishedEntries, type PublicEntry } from "@/lib/seasonStreaming";
import { seasonInfo } from "@/lib/season";
import { STREAM_SERVICES, publicSearchUrl } from "@/lib/streaming";
import { getWeekly, type WeeklyDay } from "@/lib/weekly";
import PageHeader from "@/components/PageHeader";
import ServiceIcon from "@/components/ServiceIcon";
import Mascot from "@/components/Mascot";

// 1時間ごとに作り直す（日付が変わると「今日から7日間」も自動で進む）
export const revalidate = 3600;

const TITLE = "今週のアニメ放送・配信スケジュール（曜日別）｜アニミル！";
const DESC =
  "今日から7日間の今期アニメを、曜日ごとに放送・配信の時刻順で一覧にしました。最初に放送するテレビ局、話数、見られる配信サービス（Prime Video・U-NEXT・dアニメストア・ABEMA など）がひと目で分かります。毎日自動で更新。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/streaming/weekly" },
  openGraph: { title: TITLE, description: DESC, url: "/streaming/weekly", images: [OG_IMAGE] },
};

const ORDER = new Map(STREAM_SERVICES.map((s, i) => [s.key, i]));
const sortServices = (list: PublicEntry[]) =>
  [...list].sort((a, b) => (ORDER.get(a.serviceKey) ?? 99) - (ORDER.get(b.serviceKey) ?? 99));

export default async function WeeklyPage() {
  const seasonKey = await latestSeasonKeyWithData().catch(() => "");
  const [entries, seasonWorks] = await Promise.all([
    seasonKey ? getPublishedEntries(seasonKey).catch(() => []) : Promise.resolve([] as PublicEntry[]),
    fetchSeasonPopular().catch(() => []),
  ]);
  const days: WeeklyDay[] = await getWeekly(entries, seasonWorks).catch(() => []);
  const season = seasonKey ? seasonInfo(seasonKey) : null;
  const total = days.reduce((n, d) => n + d.items.length, 0);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-6 lg:max-w-5xl lg:px-8">
      <PageHeader
        crumbs={[{ href: "/", label: "ホーム" }, { href: "/streaming", label: "今期配信" }, { label: "今週のスケジュール" }]}
        eyebrow="This week"
        title={<>今週のアニメ<br className="sm:hidden" /> 放送・配信スケジュール</>}
        desc={
          <>
            <p>今日から7日間の今期アニメを、曜日ごとに放送・配信の時刻順で並べています。毎日自動で更新されます。</p>
            <p className="mt-1 text-xs">
              深夜アニメの慣習に合わせ、0〜4時台は前日の「24〜28時」で表しています。放送時刻はしょぼいカレンダー、
              配信サービスは各作品の公式サイトで確認した情報です。放送・配信の予定は変わることがあります。
            </p>
          </>
        }
      >
        {days.length > 0 && (
          <nav aria-label="日付" className="mt-5 flex gap-1.5 overflow-x-auto pb-1">
            {days.map((d, i) => (
              <a
                key={d.date}
                href={`#day-${i}`}
                className={`flex-none rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  d.isToday ? "bg-ink text-white" : "border border-line bg-white text-ink-2 hover:border-amber hover:text-ink"
                }`}
              >
                {d.isToday ? `今日 ${d.label}` : d.label}
                <span className="num ml-1 opacity-70">{d.items.length}</span>
              </a>
            ))}
          </nav>
        )}
      </PageHeader>

      {total === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-line bg-white p-10 text-center text-sm text-ink-2">
          <Mascot pose="sit" h={120} />
          <p>今週の放送・配信の予定を準備しています。しばらくしてからもう一度ご覧ください。</p>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {days.map((d, i) => (
            <section key={d.date} id={`day-${i}`} className="scroll-mt-20" aria-labelledby={`day-${i}-h`}>
              <h2 id={`day-${i}-h`} className="flex items-baseline gap-2 text-lg font-black text-ink">
                {d.isToday && <span className="rounded-full bg-[#C0392B] px-2 py-0.5 text-[11px] font-bold text-white">今日</span>}
                {d.label}
                <span className="num text-xs font-bold text-ink-2">{d.items.length}作品</span>
              </h2>
              {d.items.length === 0 ? (
                <p className="mt-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink-2">
                  この日に放送・配信される今期の作品は見つかりませんでした。
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
                  {d.items.map((it) => {
                    const services = sortServices(it.services);
                    return (
                      <li key={`${d.date}-${it.workId ?? it.title}`} className="flex gap-3 px-4 py-3 sm:gap-4">
                        <p className="num w-12 flex-none pt-0.5 text-[15px] font-black text-ink">{it.timeLabel || "—"}</p>
                        <div className="h-[60px] w-[42px] flex-none overflow-hidden rounded-lg bg-paper-2 ring-1 ring-black/5">
                          {it.cover && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-bold leading-snug text-ink">
                            {it.workId ? (
                              <Link href={`/work/${it.workId}`} className="hover:text-amber-ink hover:underline">
                                {it.title}
                              </Link>
                            ) : (
                              it.title
                            )}
                          </p>
                          <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-ink-2">
                            {it.tv && (
                              <span>
                                {it.tv.ch}
                                {it.tv.chCount > 1 ? ` ほか${it.tv.chCount - 1}局` : ""}
                                {it.tv.ep != null ? `・第${it.tv.ep}話` : ""}
                              </span>
                            )}
                            {it.weeklyServices.length > 0 && (
                              <span>
                                毎週配信：{it.weeklyServices.slice(0, 3).join("・")}
                                {it.weeklyServices.length > 3 ? ` ほか${it.weeklyServices.length - 3}社` : ""}
                              </span>
                            )}
                            {it.startsToday.length > 0 && (
                              <span className="rounded-full bg-[#EAF3DE] px-2 font-bold text-[#3B6D11]">
                                この日から配信：{it.startsToday.join("・")}
                              </span>
                            )}
                          </p>
                          {services.length > 0 && (
                            <ul className="mt-1.5 flex flex-wrap gap-1">
                              {services.map((e) => {
                                const href = e.watchUrl ?? publicSearchUrl(e.serviceKey, it.title);
                                const icon = <ServiceIcon name={e.serviceName} size={22} />;
                                return (
                                  <li key={e.serviceKey}>
                                    {href ? (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={e.watchUrl ? `${e.serviceName}で見る` : `${e.serviceName}で検索`}
                                        className="block rounded-[22%] transition hover:-translate-y-0.5"
                                      >
                                        {icon}
                                      </a>
                                    ) : (
                                      icon
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2 text-xs font-bold">
        {season && (
          <Link href={`/streaming/${season.key}`} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-amber-ink transition hover:border-amber">
            {season.label}の配信サービス別一覧 ›
          </Link>
        )}
        <Link href="/calendar" className="rounded-full border border-line bg-white px-3.5 py-1.5 text-amber-ink transition hover:border-amber">
          登録した作品だけの放送カレンダー ›
        </Link>
      </div>
      <p className="mt-6 text-[11px] text-ink-2">出典：しょぼいカレンダー・各作品の公式サイト・各配信サービス公式・AniList</p>
    </main>
  );
}
