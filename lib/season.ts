// シーズン(季節)計算と seasonKey のユーティリティ（JST基準）。今期配信一覧で共通利用。
// 冬:1-3 / 春:4-6 / 夏:7-9 / 秋:10-12。seasonKey例 "2026-summer"。
export type Season = "winter" | "spring" | "summer" | "fall";

const SEASON_JA: Record<Season, string> = {
  winter: "冬",
  spring: "春",
  summer: "夏",
  fall: "秋",
};
const ORDER: Season[] = ["winter", "spring", "summer", "fall"];
const ANILIST: Record<Season, "WINTER" | "SPRING" | "SUMMER" | "FALL"> = {
  winter: "WINTER",
  spring: "SPRING",
  summer: "SUMMER",
  fall: "FALL",
};

function jstNow(): Date {
  return new Date(Date.now() + 9 * 3600 * 1000);
}

export function seasonOfMonth(month1to12: number): Season {
  if (month1to12 <= 3) return "winter";
  if (month1to12 <= 6) return "spring";
  if (month1to12 <= 9) return "summer";
  return "fall";
}

export function currentSeasonKey(): string {
  const d = jstNow();
  return `${d.getUTCFullYear()}-${seasonOfMonth(d.getUTCMonth() + 1)}`;
}

export type SeasonInfo = {
  key: string; // "2026-summer"
  year: number;
  season: Season;
  label: string; // "2026年夏アニメ"
  anilistSeason: "WINTER" | "SPRING" | "SUMMER" | "FALL";
};

export function parseSeasonKey(key: string): SeasonInfo | null {
  const m = /^(\d{4})-(winter|spring|summer|fall)$/.exec(key || "");
  if (!m) return null;
  const year = Number(m[1]);
  const season = m[2] as Season;
  return {
    key: `${year}-${season}`,
    year,
    season,
    label: `${year}年${SEASON_JA[season]}アニメ`,
    anilistSeason: ANILIST[season],
  };
}

// 不正なキーは現在シーズンにフォールバック
export function seasonInfo(key: string): SeasonInfo {
  return parseSeasonKey(key) ?? parseSeasonKey(currentSeasonKey())!;
}

// 前(-1)/次(+1)シーズンの seasonKey
export function adjacentSeasonKey(key: string, dir: -1 | 1): string {
  const info = parseSeasonKey(key) ?? parseSeasonKey(currentSeasonKey())!;
  let i = ORDER.indexOf(info.season) + dir;
  let year = info.year;
  if (i < 0) {
    i = ORDER.length - 1;
    year -= 1;
  } else if (i >= ORDER.length) {
    i = 0;
    year += 1;
  }
  return `${year}-${ORDER[i]}`;
}

// 配信一覧として表示してよい季節の範囲（2026-10-26）：データを持ち始めた 2026年以降、来期の次まで。
// 範囲外（1967年冬 など）は 404 にして、Google が季節ページを無限にたどらないようにする
export function servableSeason(key: string): SeasonInfo | null {
  const info = parseSeasonKey(key);
  if (!info) return null;
  const nowYear = jstNow().getUTCFullYear();
  if (info.year < 2026 || info.year > nowYear + 1) return null;
  return info;
}
