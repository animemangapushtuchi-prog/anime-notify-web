// トップページの「今夜の放送」。しょぼいカレンダー由来の番組表（cache/tvSchedule）から、
// これから翌朝5時（JST）までのテレビ放送を、作品ごとに1件（いちばん早い放送）にまとめて返す。
// AniList の今期作品とタイトルが一致したものには、表紙と作品ページへのリンクを付ける。
// 一致しない作品は表紙なし・リンクなしで出す（推測でリンクを作らない）。
import { getTvPrograms, isTvBroadcastChannel, normTitle } from "@/lib/home";
import type { SeasonAnime } from "@/lib/anilist";

export type TonightItem = {
  title: string;
  st: number; // 放送開始（UNIX秒）
  ch: string; // 最初に放送する局
  chCount: number; // 放送する局の数
  ep: number | null;
  workId: number | null;
  cover: string;
};

export type Tonight = {
  label: string; // 「今夜」または「今日これから」
  dateLabel: string; // 「10/1（水）」
  items: TonightItem[];
};

const WD = ["日", "月", "火", "水", "木", "金", "土"];
const jst = (sec: number) => new Date((sec + 9 * 3600) * 1000);

// 深夜アニメの慣習に合わせ、0〜4時台は「24〜28時」で表す
export function lateNightTime(st: number): string {
  const d = jst(st);
  let h = d.getUTCHours();
  if (h < 5) h += 24;
  return `${h}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export async function getTonight(works: SeasonAnime[], now = Math.floor(Date.now() / 1000)): Promise<Tonight> {
  const d = jst(now);
  const h = d.getUTCHours();
  // 「今夜」の基準日：0〜4時台は前日の夜の続きとして扱う
  const base = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (h < 5 ? 1 : 0)));
  const dateLabel = `${base.getUTCMonth() + 1}/${base.getUTCDate()}（${WD[base.getUTCDay()]}）`;
  // 翌朝5時（JST）まで
  const end = Math.floor(base.getTime() / 1000) - 9 * 3600 + 29 * 3600;
  const start = now - 15 * 60;

  const progs = await getTvPrograms();
  const byTitle = new Map<string, TonightItem & { chs: Set<string> }>();
  for (const p of progs) {
    if (p.st < start || p.st >= end || !isTvBroadcastChannel(p.ch)) continue;
    const key = normTitle(p.title);
    if (!key) continue;
    const cur = byTitle.get(key);
    if (cur) {
      cur.chs.add(p.ch);
      if (p.st < cur.st) Object.assign(cur, { st: p.st, ch: p.ch, ep: p.count });
      continue;
    }
    byTitle.set(key, { title: p.title, st: p.st, ch: p.ch, chCount: 1, ep: p.count, workId: null, cover: "", chs: new Set([p.ch]) });
  }

  const norm = works.map((w) => ({ w, n: normTitle(w.title) })).filter((x) => x.n.length >= 2);
  const items = [...byTitle.entries()]
    .map(([key, it]) => {
      // 完全一致を優先し、無ければ「番組表の題名が作品名を含む／その逆」で照合する
      const hit = norm.find((x) => x.n === key) ?? norm.find((x) => key.includes(x.n) || x.n.includes(key));
      const { chs, ...rest } = it;
      return { ...rest, chCount: chs.size, workId: hit?.w.id ?? null, cover: hit?.w.coverUrl ?? "" };
    })
    .sort((a, b) => a.st - b.st);

  return { label: h >= 15 || h < 5 ? "今夜" : "今日これから", dateLabel, items };
}

// 今日の曜日（月曜=0 … 日曜=6、JST）。トップの「カレンダーの絵」で今日を光らせるのに使う
export function todayIndexMon(now = Date.now()): number {
  return (new Date(now + 9 * 3600 * 1000).getUTCDay() + 6) % 7;
}
