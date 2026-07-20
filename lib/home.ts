// ホーム用データ：監視キャッシュ(cache/watchedWorks)＋番組表(cache/tvSchedule)を読み、
// 登録作品の「次の予定」「放送局」「配信サービス」を補完する（旧Flutter版のHomeData相当）。
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isOverseasOnlyService, svcRank } from "@/lib/anilist";
import { getUserPrefs } from "@/lib/subscriptions";

export type WatchedInfo = {
  nextEp: number | null;
  nextAt: number | null; // UNIX秒
  episodes: number | null;
  services: string[];
  cover: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getWatchedMap(): Promise<Map<number, WatchedInfo>> {
  const map = new Map<number, WatchedInfo>();
  try {
    const snap = await getDoc(doc(db, "cache", "watchedWorks"));
    const works = (snap.data()?.works ?? []) as any[];
    for (const w of works) {
      if (typeof w.id !== "number") continue;
      const raw = ((w.externalLinks ?? []) as any[])
        .filter((l) => (l.type ?? "") === "STREAMING")
        .map((l) => String(l.site ?? ""))
        .filter((s) => s && !isOverseasOnlyService(s));
      raw.sort((a, b) => svcRank(a, "") - svcRank(b, ""));
      const seen = new Set<string>();
      const services: string[] = [];
      for (const s of raw) {
        if (!seen.has(s)) {
          seen.add(s);
          services.push(s);
        }
      }
      map.set(w.id, {
        nextEp: w.nextAiringEpisode?.episode ?? null,
        nextAt: w.nextAiringEpisode?.airingAt ?? null,
        episodes: typeof w.episodes === "number" ? w.episodes : null,
        services: services.slice(0, 3),
        cover: String(w.coverImage?.large ?? ""),
      });
    }
  } catch {
    /* noop */
  }
  return map;
}

export type TvProgram = { title: string; st: number; ch: string; count: number | null };

function normTitle(s: string): string {
  return (s || "")
    .replace(/[\s　]/g, "")
    .replace(/[～〜~！!？?・、。「」『』（）()]/g, "")
    .toLowerCase();
}

// しょぼいカレンダーにはテレビ局だけでなくネット同時配信のチャンネルも含まれる。
// 「テレビ放送」として扱う場所では、ネット配信サービスを必ず除外する。
const INTERNET_CHANNEL_PATTERNS = [
  /abema/i,
  /ニコニコ/,
  /youtube/i,
  /amazon\s*prime/i,
  /prime\s*video/i,
  /netflix/i,
  /dアニメ/i,
  /unext/i,
  /u-next/i,
  /hulu/i,
  /disney\+?/i,
  /fod/i,
  /lemino/i,
  /tver/i,
  /telasa/i,
  /dmm\s*tv/i,
  /bandai\s*channel/i,
  /バンダイチャンネル/,
  /ネット配信/,
  /web配信/i,
];

export function isTvBroadcastChannel(ch: string): boolean {
  const name = ch.trim();
  return !!name && !INTERNET_CHANNEL_PATTERNS.some((pattern) => pattern.test(name));
}

export async function getTvPrograms(): Promise<TvProgram[]> {
  try {
    const snap = await getDoc(doc(db, "cache", "tvSchedule"));
    const list = (snap.data()?.programs ?? []) as any[];
    return list
      .filter((p) => typeof p.stTime === "number")
      .map((p) => ({
        title: String(p.title ?? ""),
        st: p.stTime as number,
        ch: String(p.chName ?? ""),
        count: typeof p.count === "number" ? p.count : null,
      }));
  } catch {
    return [];
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// タイトル照合で直近の放送を返す（放送局取得用）
export function matchStation(workTitle: string, progs: TvProgram[]): TvProgram | null {
  const w = normTitle(workTitle);
  if (!w) return null;
  const now = Date.now() / 1000;
  let best: TvProgram | null = null;
  for (const p of progs) {
    if (!isTvBroadcastChannel(p.ch)) continue;
    const t = normTitle(p.title);
    if (!t) continue;
    if (t.includes(w) || w.includes(t)) {
      if (p.st < now) continue; // 未来の放送を優先
      if (!best || p.st < best.st) best = p;
    }
  }
  return best;
}

// 局ごとの週次放送スロット（深夜アニメは 24〜28時表記に補正）。
export type BroadcastSlot = {
  ch: string;
  weekday: number; // 0=日..6=土（深夜は前日側に寄せる）
  hhmm: string; // "23:30" / "25:00" など
  nextAt: number | null; // 次の放送のUNIX秒（未来がなければnull）
};

export function broadcastSlots(workTitle: string, progs: TvProgram[]): BroadcastSlot[] {
  const w = normTitle(workTitle);
  if (!w) return [];
  const now = Date.now() / 1000;
  const map = new Map<string, BroadcastSlot>();
  for (const p of progs) {
    if (!isTvBroadcastChannel(p.ch)) continue;
    const t = normTitle(p.title);
    if (!t) continue;
    if (!(t.includes(w) || w.includes(t))) continue;
    const d = new Date((p.st + 9 * 3600) * 1000); // JST
    let hh = d.getUTCHours();
    let wd = d.getUTCDay();
    if (hh < 5) {
      // 深夜(0〜4時)は前日の 24〜28時扱い（例：木1:00 → 水25:00）
      hh += 24;
      wd = (wd + 6) % 7;
    }
    const hhmm = `${hh}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    const key = `${p.ch}|${wd}|${hhmm}`;
    const ex = map.get(key);
    const future = p.st >= now ? p.st : null;
    if (!ex) {
      map.set(key, { ch: p.ch, weekday: wd, hhmm, nextAt: future });
    } else if (future != null && (ex.nextAt == null || future < ex.nextAt)) {
      ex.nextAt = future;
    }
  }
  return [...map.values()].sort(
    (a, b) => a.ch.localeCompare(b.ch) || a.weekday - b.weekday || a.hhmm.localeCompare(b.hhmm)
  );
}

// 直近の放送1件（局指定があればその局に限定）。次回の放送表示用。
export function nextBroadcast(
  workTitle: string,
  progs: TvProgram[],
  channels?: string[]
): TvProgram | null {
  const w = normTitle(workTitle);
  if (!w) return null;
  const now = Date.now() / 1000;
  const chSet = channels && channels.length ? new Set(channels) : null;
  let best: TvProgram | null = null;
  for (const p of progs) {
    if (p.st < now) continue;
    if (!isTvBroadcastChannel(p.ch)) continue;
    if (chSet && !chSet.has(p.ch)) continue;
    const t = normTitle(p.title);
    if (!t) continue;
    if (!(t.includes(w) || w.includes(t))) continue;
    if (!best || p.st < best.st) best = p;
  }
  return best;
}

// 番組表に出てくる放送局の一覧（設定の選択肢用）
export function distinctChannels(progs: TvProgram[]): string[] {
  const set = new Set<string>();
  for (const p of progs) if (isTvBroadcastChannel(p.ch)) set.add(p.ch);
  return [...set].sort((a, b) => a.localeCompare(b, "ja"));
}

// 放送局のざっくり分類（地上波/BS/CS）
const CS_CHANNELS = ["AT-X", "アニマックス", "キッズステーション", "日テレプラス", "ANIMAX"];
export function channelGroup(ch: string): "地上波" | "BS" | "CS" {
  if (/^(BS|ＢＳ)/.test(ch)) return "BS";
  if (CS_CHANNELS.some((c) => ch.includes(c))) return "CS";
  return "地上波";
}

// ユーザーが設定した「視聴できる放送局」
// users/{uid} の読み込みは共有キャッシュ（lib/subscriptions）に集約し、同一ページ内の重複読込を避ける
export async function getUserChannels(uid: string): Promise<string[]> {
  try {
    return (await getUserPrefs(uid)).channels;
  } catch {
    return [];
  }
}
