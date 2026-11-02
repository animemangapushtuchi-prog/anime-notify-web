import Link from "next/link";
import type { PublicEntry } from "@/lib/seasonStreaming";
import { startLabel, type ScheduledWork, type UpcomingSeason } from "@/lib/upcoming";
import ServiceIcon from "@/components/ServiceIcon";

// 来期の放送予定。公式サイトで確かめた開始日・放送局を、日付順に並べる。
// 配信先が確認できた作品にはアイコンを付ける（発表前の作品は書かない）
export default function UpcomingSeasonList({ data, entries }: { data: UpcomingSeason; entries: PublicEntry[] }) {
  const tv = data.works.filter((w) => w.kind === "tv");
  const dated = tv.filter((w) => w.start.length === 10);
  const monthOnly = tv.filter((w) => w.start.length < 10);
  const movies = data.works.filter((w) => w.kind === "movie");

  // 日付ごとにまとめる
  const days = new Map<string, ScheduledWork[]>();
  for (const w of dated) days.set(w.start, [...(days.get(w.start) ?? []), w]);

  const services = (id: number) => entries.filter((e) => e.anilistId === id);

  return (
    <div className="mt-8 space-y-10">
      {days.size > 0 && (
        <section aria-labelledby="dated-h">
          <h2 id="dated-h" className="text-xl font-black text-ink">放送開始日が決まっている作品<span className="num ml-2 text-sm text-ink-2">{dated.length}</span></h2>
          <div className="mt-4 space-y-5">
            {[...days.entries()].map(([day, list]) => (
              <div key={day}>
                <h3 className="text-sm font-black text-amber-ink">{startLabel(day)}</h3>
                <WorkGrid works={list} services={services} />
              </div>
            ))}
          </div>
        </section>
      )}

      {monthOnly.length > 0 && (
        <section aria-labelledby="month-h">
          <h2 id="month-h" className="text-xl font-black text-ink">{startLabel(monthOnly[0].start)}放送の作品<span className="num ml-2 text-sm text-ink-2">{monthOnly.length}</span></h2>
          <p className="mt-1 text-xs text-ink-2">公式サイトで放送時期まで確認できた作品です。日付が発表されたら上の欄へ移します。</p>
          <WorkGrid works={monthOnly} services={services} />
        </section>
      )}

      {movies.length > 0 && (
        <section aria-labelledby="movie-h">
          <h2 id="movie-h" className="text-xl font-black text-ink">同じ時期に公開される劇場作品<span className="num ml-2 text-sm text-ink-2">{movies.length}</span></h2>
          <WorkGrid works={movies} services={services} showDate />
        </section>
      )}
    </div>
  );
}

function WorkGrid({ works, services, showDate = false }: { works: ScheduledWork[]; services: (id: number) => PublicEntry[]; showDate?: boolean }) {
  return (
    <ul className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {works.map((w) => {
        const list = services(w.id);
        return (
          <li key={w.id} className="relative flex gap-3 rounded-2xl border border-line bg-white p-2.5 transition hover:border-amber">
            <div className="h-[84px] w-[60px] flex-none overflow-hidden rounded-lg bg-paper-2 ring-1 ring-black/5">
              {w.cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/work/${w.id}`} className="line-clamp-2 text-sm font-bold leading-snug text-ink after:absolute after:inset-0 hover:text-amber-ink">
                {w.title}
              </Link>
              {(showDate || w.slot) && (
                <p className="mt-0.5 text-[11px] font-bold text-amber-ink">{showDate ? startLabel(w.start) : w.slot}</p>
              )}
              {w.tv && <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-2">{w.tv}</p>}
              {list.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-1" aria-label="配信サービス">
                  {list.map((e) => (
                    <li key={e.serviceKey}><ServiceIcon name={e.serviceName} size={20} /></li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
