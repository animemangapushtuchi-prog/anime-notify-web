// 来期の放送予定（content/upcoming/{季節}.json）。各作品の公式サイトで確かめた開始時期・放送局だけを持つ。
// 季節を足すときは JSON を置いて、下の ALL に1行足す。
import winter2027 from "@/content/upcoming/2027-winter.json";
import { isBeforeStart } from "@/lib/upcomingDates";

export { startLabel } from "@/lib/upcomingDates";

export type ScheduledWork = {
  id: number; // AniList ID
  title: string;
  cover: string;
  kind: "tv" | "movie";
  start: string; // "2027-01-10"（日付まで発表済み）または "2027-01"（月だけ発表済み）
  slot: string; // 「毎週日曜 17:00〜」。未発表なら空
  tv: string; // 放送局。未発表なら空
  sourceUrl: string; // 確認した公式ページ
};

export type UpcomingSeason = { season: string; checkedAt: string; works: ScheduledWork[] };

const ALL: Record<string, UpcomingSeason> = {
  "2027-winter": winter2027 as UpcomingSeason,
};

// その季節の、まだ始まっていない作品だけを返す。無ければ null
export function upcomingSeason(key: string, nowSec = Math.floor(Date.now() / 1000)): UpcomingSeason | null {
  const s = ALL[key];
  if (!s) return null;
  const works = s.works.filter((w) => isBeforeStart(w.start, nowSec));
  return works.length > 0 ? { ...s, works } : null;
}

export function scheduledWork(id: number, nowSec = Math.floor(Date.now() / 1000)): (ScheduledWork & { checkedAt: string }) | null {
  for (const s of Object.values(ALL)) {
    const w = s.works.find((x) => x.id === id);
    if (w && isBeforeStart(w.start, nowSec)) return { ...w, checkedAt: s.checkedAt };
  }
  return null;
}
