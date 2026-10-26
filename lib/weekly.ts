// 「今週の放送・配信スケジュール」（/streaming/weekly）のデータを作る（サーバー専用）。
//
// - テレビ放送：しょぼいカレンダー由来の番組表（cache/tvSchedule、約1週間先まで）
// - ネット配信：アニミル！の確認済み配信データ（今期）。曜日が分かる配信は、その曜日にも並べる
// - 番組表の題名は、今期の作品（配信データ・AniList の今期作品）と題名が一致したものだけを使う
//   （再放送や過去作は今期の作品と一致しないので並ばない。推測でリンクは作らない）
// - 1日の区切りは朝5時（深夜アニメの慣習。0〜4時台は前日の「24〜28時」）
import { getTvPrograms, isTvBroadcastChannel, normTitle } from "@/lib/home";
import { lateNightTime } from "@/lib/tonight";
import type { PublicEntry } from "@/lib/seasonStreaming";
import type { SeasonAnime } from "@/lib/anilist";

export type WeeklyItem = {
  workId: number | null;
  title: string;
  cover: string;
  sortKey: number; // その日の中での並び順（5時からの分数）
  timeLabel: string; // 「24:30」
  tv: { ch: string; chCount: number; ep: number | null } | null; // 最初のテレビ放送
  weeklyServices: string[]; // この曜日に毎週配信と分かっているサービス名
  services: PublicEntry[]; // その作品の確認済み配信（全部）
  startsToday: string[]; // この日から配信が始まるサービス名
};

export type WeeklyDay = { date: string; label: string; isToday: boolean; items: WeeklyItem[] };

const WD = ["日", "月", "火", "水", "木", "金", "土"];
const jstDate = (sec: number) => new Date((sec + 9 * 3600) * 1000);

// 5時区切りの「その日」（JST の 0:00 を表す UNIX 秒）
function broadcastDayStart(sec: number): number {
  const d = jstDate(sec);
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (d.getUTCHours() < 5 ? 1 : 0));
  return Math.floor(day / 1000) - 9 * 3600;
}

// "24:30" → 5時からの分数（並び順用）。"9:00" のような朝の時刻はそのまま
function minutesFrom5(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const hh = h < 5 ? h + 24 : h;
  return (hh - 5) * 60 + (m || 0);
}

export async function getWeekly(
  entries: PublicEntry[],
  seasonWorks: SeasonAnime[],
  now = Math.floor(Date.now() / 1000)
): Promise<WeeklyDay[]> {
  const today = broadcastDayStart(now);
  const days: WeeklyDay[] = Array.from({ length: 7 }, (_, i) => {
    const start = today + i * 86400;
    const d = jstDate(start);
    return {
      date: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`,
      label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WD[d.getUTCDay()]}）`,
      isToday: i === 0,
      items: [],
    };
  });

  // 今期の作品（配信データがある作品＋AniList の今期作品）を題名で引けるようにする
  type Work = { id: number; title: string; cover: string; services: PublicEntry[] };
  const works = new Map<number, Work>();
  for (const e of entries) {
    const w = works.get(e.anilistId) ?? { id: e.anilistId, title: e.title, cover: e.coverImage, services: [] };
    w.services.push(e);
    if (!w.cover && e.coverImage) w.cover = e.coverImage;
    works.set(e.anilistId, w);
  }
  for (const a of seasonWorks) {
    if (!works.has(a.id)) works.set(a.id, { id: a.id, title: a.title, cover: a.coverUrl, services: [] });
    else if (!works.get(a.id)!.cover) works.get(a.id)!.cover = a.coverUrl;
  }
  const byNorm = [...works.values()].map((w) => ({ w, n: normTitle(w.title) })).filter((x) => x.n.length >= 2);
  // 番組表の題名と作品名：完全一致を優先、無ければ一方がもう一方を含むもの（4文字以上）
  const match = (title: string): Work | null => {
    const k = normTitle(title);
    if (!k) return null;
    const exact = byNorm.find((x) => x.n === k);
    if (exact) return exact.w;
    const part = byNorm.filter((x) => x.n.length >= 4 && k.length >= 4 && (k.includes(x.n) || x.n.includes(k)));
    return part.length === 1 ? part[0].w : null;
  };

  // 1日×1作品で1行にまとめる
  const rows = days.map(() => new Map<number, WeeklyItem>());
  const ensure = (dayIdx: number, w: Work): WeeklyItem => {
    const m = rows[dayIdx];
    let it = m.get(w.id);
    if (!it) {
      it = {
        workId: w.id,
        title: w.title,
        cover: w.cover,
        sortKey: 99999,
        timeLabel: "",
        tv: null,
        weeklyServices: [],
        services: [...w.services],
        startsToday: [],
      };
      m.set(w.id, it);
    }
    return it;
  };

  // テレビ放送（局ごとに複数あれば、いちばん早いものを代表にして局数を数える）
  const progs = await getTvPrograms();
  const chSets = new Map<string, Set<string>>();
  for (const p of progs) {
    if (!isTvBroadcastChannel(p.ch)) continue;
    const idx = Math.floor((broadcastDayStart(p.st) - today) / 86400);
    if (idx < 0 || idx >= 7) continue;
    const w = match(p.title);
    if (!w) continue;
    const it = ensure(idx, w);
    const key = `${idx}:${w.id}`;
    if (!chSets.has(key)) chSets.set(key, new Set());
    chSets.get(key)!.add(p.ch);
    const time = lateNightTime(p.st);
    const sk = minutesFrom5(time);
    if (!it.tv || sk < it.sortKey) {
      it.tv = { ch: p.ch, chCount: 0, ep: p.count };
      it.sortKey = sk;
      it.timeLabel = time;
    }
  }
  for (const [key, set] of chSets) {
    const [idx, id] = key.split(":").map(Number);
    const it = rows[idx].get(id);
    if (it?.tv) it.tv.chCount = set.size;
  }

  // ネット配信：毎週の曜日が分かるもの・この日から始まるもの
  for (const w of works.values()) {
    for (const e of w.services) {
      days.forEach((_, idx) => {
        const start = today + idx * 86400;
        const dow = jstDate(start).getUTCDay();
        const weeklyHere = e.weeklyDay === dow;
        const startsHere = e.firstAvailableAt != null && broadcastDayStart(e.firstAvailableAt) === start;
        if (!weeklyHere && !startsHere) return;
        const it = ensure(idx, w);
        if (weeklyHere && !it.weeklyServices.includes(e.serviceName)) it.weeklyServices.push(e.serviceName);
        if (startsHere && !it.startsToday.includes(e.serviceName)) it.startsToday.push(e.serviceName);
        // テレビ放送が無い作品は、配信の時刻で並べる
        if (!it.tv && weeklyHere && e.weeklyTime) {
          const sk = minutesFrom5(e.weeklyTime);
          if (sk < it.sortKey) {
            it.sortKey = sk;
            it.timeLabel = e.weeklyTime;
          }
        }
      });
    }
  }

  days.forEach((d, i) => {
    d.items = [...rows[i].values()].sort((a, b) => a.sortKey - b.sortKey || a.title.localeCompare(b.title, "ja"));
  });
  return days;
}
