// ホーム用データ：監視キャッシュ(cache/watchedWorks)＋番組表(cache/tvSchedule)を読み、
// 登録作品の「次の予定」「放送局」「配信サービス」を補完する（旧Flutter版のHomeData相当）。
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isOverseasOnlyService, svcRank } from "@/lib/anilist";

export type WatchedInfo = {
  nextEp: number | null;
  nextAt: number | null; // UNIX秒
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
        services: services.slice(0, 3),
        cover: String(w.coverImage?.large ?? ""),
      });
    }
  } catch {
    /* noop */
  }
  return map;
}

export type TvProgram = { title: string; st: number; ch: string };

function normTitle(s: string): string {
  return (s || "")
    .replace(/[\s　]/g, "")
    .replace(/[～〜~！!？?・、。「」『』（）()]/g, "")
    .toLowerCase();
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
    const t = normTitle(p.title);
    if (!t) continue;
    if (t.includes(w) || w.includes(t)) {
      if (p.st < now) continue; // 未来の放送を優先
      if (!best || p.st < best.st) best = p;
    }
  }
  return best;
}
