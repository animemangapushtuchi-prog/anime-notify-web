// 候補の自動生成：AniList（今期の母集団）＋ cache/streamSchedule（配信枠）から
// 「候補(candidate)」を作る。外部サイトのスクレイピングは行わない。
// 既存の confirmed / rejected / メモ / 公開設定は壊さない（applyImport の規約に従う）。
import { seasonInfo } from "@/lib/season";
import { normTitle } from "@/lib/home";
import { getStreamSchedule, normalizeService, type StreamProgram } from "@/lib/streaming";
import { applyImport, type ImportRow, type ImportResult } from "@/lib/seasonAdmin";

const ANILIST = "https://graphql.anilist.co";

// 指定シーズンのTV/TV_SHORT/ONAを取得（劇場版・OVA・SPECIALと成人向けは除外）
const SEASON_LIST_QUERY = `
query ($season: MediaSeason, $seasonYear: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(
      season: $season
      seasonYear: $seasonYear
      type: ANIME
      format_in: [TV, TV_SHORT, ONA]
      isAdult: false
      sort: POPULARITY_DESC
    ) {
      id
      title { native romaji }
      coverImage { large }
      externalLinks { site url type language }
    }
  }
}`;

export type SeasonWork = {
  id: number;
  title: string;
  cover: string;
  links: { site: string; url: string; type: string; language: string }[];
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchSeasonWorks(seasonKey: string): Promise<SeasonWork[]> {
  const info = seasonInfo(seasonKey);
  const out: SeasonWork[] = [];
  for (let page = 1; page <= 6; page++) {
    const res = await fetch(ANILIST, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: SEASON_LIST_QUERY,
        variables: { season: info.anilistSeason, seasonYear: info.year, page },
      }),
    });
    if (!res.ok) throw new Error(`AniList ${res.status}`);
    const json = await res.json();
    const media = json?.data?.Page?.media ?? [];
    for (const m of media) {
      out.push({
        id: Number(m.id),
        title: String(m.title?.native ?? m.title?.romaji ?? ""),
        cover: String(m.coverImage?.large ?? ""),
        links: (m.externalLinks ?? []).map((l: any) => ({
          site: String(l?.site ?? ""),
          url: String(l?.url ?? ""),
          type: String(l?.type ?? ""),
          language: String(l?.language ?? ""),
        })),
      });
    }
    if (!json?.data?.Page?.pageInfo?.hasNextPage) break;
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// 番組表の配信枠と作品タイトルの照合（誤結合を避け、短い一致・期違いは採用しない）
function matchProgramsStrict(title: string, programs: StreamProgram[]): StreamProgram[] {
  const wt = normTitle(title);
  if (!wt || wt.length < 4) return [];
  const out: StreamProgram[] = [];
  for (const p of programs) {
    const pt = normTitle(p.title);
    if (!pt || pt.length < 4) continue;
    if (pt === wt) {
      out.push(p);
      continue;
    }
    // 包含一致は「第2期/Season2 等の表記が両側で食い違わない」ときだけ採用
    if (pt.includes(wt) || wt.includes(pt)) {
      const seasonNum = (s: string) => {
        const m = /(第?([0-9０-９]+)期|season\s*([0-9]+)|([0-9]+)nd|([0-9]+)rd|([0-9]+)th)/i.exec(s);
        return m ? m[0] : "";
      };
      if (seasonNum(pt) === seasonNum(wt)) out.push(p);
    }
  }
  return out;
}

// 曜日・時刻（JST）を配信枠から求める
function weeklyOf(p: StreamProgram): { day: number; time: string } {
  const d = new Date((p.stTime + 9 * 3600) * 1000);
  const two = (n: number) => String(n).padStart(2, "0");
  return { day: d.getUTCDay(), time: `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}` };
}

// 今日から、そのシーズンの終わりまでの日数（最大92日）。番組表は未来ぶんしか取れないため。
function daysToSeasonEnd(seasonKey: string): number {
  const info = seasonInfo(seasonKey);
  const startMonth = { winter: 1, spring: 4, summer: 7, fall: 10 }[info.season];
  const endMs = Date.UTC(info.year, startMonth + 2, 0, 23, 59, 59) - 9 * 3600 * 1000; // JSTの月末
  const diff = Math.ceil((endMs - Date.now()) / 86400000);
  return Math.min(Math.max(diff, 1), 92);
}

// シーズン終わりまでのネット配信枠を取得（既存の8日分キャッシュより広く拾う）
async function fetchSeasonStreamPrograms(seasonKey: string): Promise<StreamProgram[]> {
  const res = await fetch(`/api/syobocal?days=${daysToSeasonEnd(seasonKey)}`);
  if (!res.ok) return [];
  const json = (await res.json()) as {
    items?: { pid: number; tid: number; title: string; count: number | null; stTime: number; chName: string }[];
  };
  const out: StreamProgram[] = [];
  for (const p of json.items ?? []) {
    // ネット配信サービスとして正規化できるものだけ（テレビ局・YouTube・不明は除外）
    const svc = normalizeService(p.chName);
    if (!svc) continue;
    out.push({
      pid: p.pid,
      tid: p.tid,
      title: p.title,
      count: p.count,
      stTime: p.stTime,
      chName: p.chName,
      serviceKey: svc.key,
      serviceName: svc.name,
    });
  }
  return out;
}

export type BuildResult = ImportResult & { works: number; rows: number };

// 候補を生成して取り込む。生成物はすべて candidate（自動で確認済みにはしない）。
export async function buildCandidates(seasonKey: string): Promise<BuildResult> {
  const [works, sched, seasonProgs] = await Promise.all([
    fetchSeasonWorks(seasonKey),
    getStreamSchedule(),
    fetchSeasonStreamPrograms(seasonKey).catch(() => [] as StreamProgram[]),
  ]);
  // シーズン期間ぶん＋既存キャッシュを合成（同じ番組IDは1件に）
  const byPid = new Map<number, StreamProgram>();
  for (const p of [...seasonProgs, ...sched.programs]) {
    if (!byPid.has(p.pid)) byPid.set(p.pid, p);
  }
  const programs = [...byPid.values()];

  const rows: ImportRow[] = [];
  const seen = new Set<string>();

  for (const w of works) {
    // 1) 番組表の配信枠から（日時の根拠あり）。同一作品×サービスは最も早い枠＝初回配信を採用
    const matched = matchProgramsStrict(w.title, programs);
    const earliest = new Map<string, StreamProgram>();
    for (const p of matched) {
      const cur = earliest.get(p.serviceKey);
      if (!cur || p.stTime < cur.stTime) earliest.set(p.serviceKey, p);
    }
    for (const [serviceKey, p] of earliest) {
      const key = `${w.id}_${serviceKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const wk = weeklyOf(p);
      rows.push({
        anilistId: w.id,
        title: w.title,
        serviceKey,
        coverImage: w.cover,
        availability: "unknown", // 見放題かどうかは根拠がないので確定しない
        firstAvailableAt: p.stTime,
        weeklyDay: wk.day,
        weeklyTime: wk.time,
        sourceType: "syobocal",
        sourceLabel: "しょぼいカレンダー（ネット配信枠）",
        sourceUrl: "",
      });
    }
    // 2) AniListの日本向け配信リンクから（日時は不明のまま）
    for (const l of w.links) {
      if (l.type !== "STREAMING") continue;
      // 正規化できないサービス（YouTube・海外専用・不明）は候補にしない
      const svc = normalizeService(l.site);
      if (!svc) continue;
      const key = `${w.id}_${svc.key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        anilistId: w.id,
        title: w.title,
        serviceKey: svc.key,
        coverImage: w.cover,
        availability: "unknown",
        firstAvailableAt: null,
        weeklyDay: null,
        weeklyTime: null,
        sourceType: "anilist",
        sourceLabel: "AniList（配信リンク）",
        sourceUrl: l.url || "",
      });
    }
  }

  const res = await applyImport(seasonKey, rows);
  return { ...res, works: works.length, rows: rows.length };
}
