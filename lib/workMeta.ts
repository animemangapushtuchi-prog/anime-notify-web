// 作品ページの検索結果用の文（確認済みの配信情報から「どこで見れるか」の答えを作る）。
// 2026-11 の Search Console では、作品ページの多くが8〜12位に表示されてもほとんど押されていなかった。
// 全作品が同じ「配信・放送情報」の題名で、検索結果だけでは答えがあるか分からなかったため。
import type { PublicEntry } from "@/lib/seasonStreaming";

type Row = Pick<PublicEntry, "serviceKey" | "serviceName" | "firstAvailableAt" | "isExclusive">;

// 検索結果で名前を出す順（よく知られているサービスを先に）
const NAME_ORDER = ["u-next", "prime-video", "netflix", "d-anime", "abema", "disney-plus", "hulu", "dmm-tv"];
const rank = (key: string) => {
  const i = NAME_ORDER.indexOf(key);
  return i < 0 ? NAME_ORDER.length : i;
};

export function orderServices<T extends Row>(list: T[]): T[] {
  return [...list].sort((a, b) => rank(a.serviceKey) - rank(b.serviceKey));
}

// まだどのサービスでも始まっていない作品か（「配信中」と言わないため）
export function isUpcoming(list: Row[], status: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  const started = (e: Row) => e.firstAvailableAt != null && e.firstAvailableAt <= nowSec;
  if (status === "放送前") return !list.some(started);
  return list.length > 0 && list.every((e) => e.firstAvailableAt != null && e.firstAvailableAt > nowSec);
}

// 「U-NEXT・Prime Videoなど13社で配信」「Netflixで独占配信」「ABEMAで配信予定」
export function whereLine(list: Row[], status: string, nowSec?: number): string {
  const rows = orderServices(list);
  const verb = isUpcoming(rows, status, nowSec) ? "配信予定" : "配信";
  if (rows.length === 1) return `${rows[0].serviceName}で${rows[0].isExclusive ? "独占" : ""}${verb}`;
  const named = rows.slice(0, 2).map((e) => e.serviceName).join("・");
  return rows.length === 2 ? `${named}で${verb}` : `${named}など${rows.length}社で${verb}`;
}

export function jstDateLabel(sec: number): string {
  const d = new Date((sec + 9 * 3600) * 1000);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

// これから配信が始まる作品（確認済みの開始日が先の日付のものだけ、開始日の早い順）
export type UpcomingWork = { id: number; title: string; at: number; services: string[] };

export function upcomingWorks(
  entries: Pick<PublicEntry, "anilistId" | "title" | "serviceName" | "firstAvailableAt">[],
  nowSec = Math.floor(Date.now() / 1000)
): UpcomingWork[] {
  const works = new Map<string, UpcomingWork>();
  for (const e of entries) {
    if (e.firstAvailableAt == null || e.firstAvailableAt <= nowSec) continue;
    const key = `${e.anilistId}_${e.firstAvailableAt}`;
    const cur = works.get(key);
    if (cur) cur.services.push(e.serviceName);
    else works.set(key, { id: e.anilistId, title: e.title, at: e.firstAvailableAt, services: [e.serviceName] });
  }
  return [...works.values()].sort((a, b) => a.at - b.at);
}

// 確認済み情報のうち、いちばん新しい確認日
export function latestCheckedLabel(list: Pick<PublicEntry, "sourceCheckedAt">[]): string | null {
  const days = list.map((e) => e.sourceCheckedAt ?? 0);
  const max = Math.max(0, ...days);
  return max > 0 ? jstDateLabel(max) : null;
}
