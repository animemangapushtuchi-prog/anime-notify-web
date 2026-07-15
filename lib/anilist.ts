// AniList データ層。作品詳細・検索・今期人気を取得し、日本語化＆日本向けフィルタを行う。
// 旧Flutter版のロジック（配信の海外専用除外・Xハンドル抽出・trailer・役職/種別の日本語化）を踏襲。

const ANILIST = "https://graphql.anilist.co";

// ---- 型 ----
export type StreamLink = { name: string; url: string; language: string };
export type CastEntry = { character: string; actor: string };
export type StaffEntry = { role: string; name: string };
export type RelatedWork = {
  id: number;
  title: string;
  relation: string;
  format: string;
  mediaType: string;
};

export type AnimeDetail = {
  id: number;
  title: string;
  titleRomaji: string;
  type: string; // 日本語化した種別
  episodes: number | null;
  status: string; // 日本語化
  score: number | null;
  synopsis: string; // AniList原文（日本語紹介はWikipedia側で補完）
  genres: string[];
  studios: string[];
  coverUrl: string;
  bannerUrl: string;
  seasonLabel: string;
  sourceJa: string;
  nextEpisode: number | null;
  nextAiringAt: number | null; // UNIX秒
  trailerVideoId: string | null;
  trailerThumb: string | null;
  xHandle: string | null;
  streaming: StreamLink[];
  cast: CastEntry[];
  staff: StaffEntry[];
  relations: RelatedWork[];
};

// ---- GraphQL 実行（ISR: revalidateで定期再取得） ----
async function gql<T>(
  query: string,
  variables: Record<string, unknown>,
  revalidate = 3600
): Promise<T> {
  const res = await fetch(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message ?? "AniList error");
  return json.data as T;
}

// ---- 日本語化ヘルパー ----
export function formatJa(f: string): string {
  switch (f) {
    case "TV": return "TVアニメ";
    case "TV_SHORT": return "TVアニメ(短編)";
    case "MOVIE": return "映画";
    case "OVA": return "OVA";
    case "ONA": return "ネット配信アニメ";
    case "SPECIAL": return "スペシャル";
    case "MUSIC": return "MV";
    case "MANGA": return "漫画";
    case "NOVEL": return "小説";
    case "ONE_SHOT": return "読み切り";
    default: return f || "作品";
  }
}
function statusJa(s: string): string {
  switch (s) {
    case "RELEASING": return "放送中";
    case "FINISHED": return "放送終了";
    case "NOT_YET_RELEASED": return "放送前";
    case "CANCELLED": return "中止";
    case "HIATUS": return "休止中";
    default: return s;
  }
}
function sourceJa(s: string): string {
  switch (s) {
    case "MANGA": return "漫画";
    case "LIGHT_NOVEL": return "ライトノベル";
    case "NOVEL": return "小説";
    case "ORIGINAL": return "オリジナル";
    case "VISUAL_NOVEL": return "ビジュアルノベル";
    case "VIDEO_GAME": return "ゲーム";
    case "GAME": return "ゲーム";
    case "WEB_NOVEL": return "Web小説";
    case "OTHER": return "その他";
    default: return "";
  }
}
function relationJa(r: string): string {
  switch (r) {
    case "SEQUEL": return "続編";
    case "PREQUEL": return "前作";
    case "SIDE_STORY": return "外伝";
    case "SPIN_OFF": return "スピンオフ";
    case "ADAPTATION": return "原作";
    case "ALTERNATIVE": return "別バージョン";
    case "PARENT": return "本編";
    case "SUMMARY": return "総集編";
    case "CHARACTER": return "共通キャラ";
    default: return r;
  }
}
function seasonLabel(season: string | null, year: number | null): string {
  if (!season || !year) return "";
  const s: Record<string, string> = {
    WINTER: "冬", SPRING: "春", SUMMER: "夏", FALL: "秋",
  };
  return `${year}年${s[season] ?? ""}`;
}
function staffRoleJa(role: string): string {
  const r = role.replace(/\s*\(.*\)/, "").trim();
  const map: Record<string, string> = {
    Director: "監督",
    "Original Creator": "原作",
    "Series Composition": "シリーズ構成",
    "Character Design": "キャラクターデザイン",
    Music: "音楽",
    "Sound Director": "音響監督",
    "Art Director": "美術監督",
    Producer: "プロデューサー",
    Screenplay: "脚本",
    Storyboard: "絵コンテ",
    Animation: "アニメーション",
  };
  return map[r] ?? r;
}
function stripHtml(s: string): string {
  return (s || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ---- 配信サービス：日本向け優先度・海外専用の除外 ----
export function svcRank(site: string, language: string): number {
  const s = site.toLowerCase();
  if (s.includes("prime video") || s === "amazon") return 0;
  if (s.includes("netflix")) return 1;
  if (s.includes("u-next") || s.includes("unext")) return 2;
  if (s.includes("d anime") || s.includes("danime") || s.includes("dアニメ")) return 3;
  if (s.includes("youtube")) return 4;
  if (s.includes("abema")) return 5;
  if (s.includes("niconico")) return 6;
  if (s.includes("hulu")) return 7;
  if (s.includes("disney")) return 8;
  if (s.includes("fod") || s.includes("lemino") || s.includes("telasa")) return 9;
  return language.toLowerCase() === "japanese" ? 20 : 40;
}
export function isOverseasOnlyService(site: string): boolean {
  const s = site.toLowerCase();
  const blocked = [
    "bilibili", "crunchyroll", "iqiyi", "iq.com", "viki", "wetv", "viu",
    "youku", "tving", "laftel", "hidive", "funimation", "bahamut", "巴哈",
    "muse", "vrv", "catchplay", "aniplus", "anime onegai",
  ];
  return blocked.some((b) => s.includes(b));
}

// ---- 詳細取得 ----
const DETAIL_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title { native romaji english }
    format episodes status averageScore
    description(asHtml: false)
    genres season seasonYear source
    coverImage { extraLarge large }
    bannerImage
    trailer { id site thumbnail }
    nextAiringEpisode { airingAt episode }
    studios(isMain: true) { nodes { name } }
    externalLinks { site url type language }
    characters(sort: ROLE, perPage: 10) {
      edges { node { name { native full } } voiceActors(language: JAPANESE) { name { native full } } }
    }
    staff(sort: RELEVANCE, perPage: 12) { edges { role node { name { native full } } } }
    relations { edges { relationType node { id type format status title { native romaji } } } }
    isAdult
  }
}`;

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchAnimeDetail(id: number): Promise<AnimeDetail | null> {
  const data = await gql<{ Media: any }>(DETAIL_QUERY, { id });
  const m = data.Media;
  if (!m || m.isAdult) return null; // 18禁は全経路で除外

  // 配信サービス（重複除去・海外専用除外・日本向け優先ソート）
  const seen = new Set<string>();
  const streaming: StreamLink[] = [];
  for (const l of m.externalLinks ?? []) {
    if ((l.type ?? "") !== "STREAMING") continue;
    const name = String(l.site ?? "");
    if (!name || seen.has(name)) continue;
    seen.add(name);
    if (isOverseasOnlyService(name)) continue;
    streaming.push({ name, url: String(l.url ?? ""), language: String(l.language ?? "") });
  }
  streaming.sort((a, b) => {
    const ra = svcRank(a.name, a.language), rb = svcRank(b.name, b.language);
    return ra !== rb ? ra - rb : a.name.localeCompare(b.name);
  });

  // Xハンドル（externalLinks の SOCIAL / twitter・x.com から）
  let xHandle: string | null = null;
  for (const l of m.externalLinks ?? []) {
    const site = String(l.site ?? "").toLowerCase();
    const url = String(l.url ?? "");
    if (!(site.includes("twitter") || site === "x" || url.includes("twitter.com/") || url.includes("x.com/"))) continue;
    const mt = url.match(/(?:twitter\.com|x\.com)\/@?([A-Za-z0-9_]{1,15})/);
    if (mt) {
      const h = mt[1];
      if (!["intent", "share", "home", "i", "hashtag", "search"].includes(h.toLowerCase())) {
        xHandle = h;
        break;
      }
    }
  }

  // PV（AniList trailer・youtubeのみ）
  const tr = m.trailer;
  const trailerVideoId =
    tr && String(tr.site ?? "").toLowerCase() === "youtube" && tr.id ? String(tr.id) : null;

  // キャスト（日本語声優がいる役だけ）
  const cast: CastEntry[] = [];
  for (const e of m.characters?.edges ?? []) {
    const cn = e.node?.name ?? {};
    const character = String(cn.native ?? cn.full ?? "");
    const vas = e.voiceActors ?? [];
    if (!character || vas.length === 0) continue;
    const vn = vas[0]?.name ?? {};
    const actor = String(vn.native ?? vn.full ?? "");
    if (!actor) continue;
    cast.push({ character, actor });
    if (cast.length >= 8) break;
  }

  // スタッフ（役職を日本語化・重複除去）
  const staff: StaffEntry[] = [];
  const seenStaff = new Set<string>();
  for (const e of m.staff?.edges ?? []) {
    const sn = e.node?.name ?? {};
    const name = String(sn.native ?? sn.full ?? "");
    const role = staffRoleJa(String(e.role ?? ""));
    if (!name || !role) continue;
    const key = `${role}|${name}`;
    if (seenStaff.has(key)) continue;
    seenStaff.add(key);
    staff.push({ role, name });
    if (staff.length >= 8) break;
  }

  // 関連作品
  const relations: RelatedWork[] = [];
  for (const e of m.relations?.edges ?? []) {
    const node = e.node ?? {};
    const nt = node.title ?? {};
    const title = String(nt.native ?? nt.romaji ?? "");
    if (!title || node.id == null) continue;
    relations.push({
      id: node.id,
      title,
      relation: relationJa(String(e.relationType ?? "")),
      format: String(node.format ?? ""),
      mediaType: String(node.type ?? ""),
    });
  }

  const t = m.title ?? {};
  const cover = m.coverImage ?? {};
  const next = m.nextAiringEpisode;
  return {
    id: m.id,
    title: String(t.native ?? t.romaji ?? t.english ?? "（無題）"),
    titleRomaji: String(t.romaji ?? t.english ?? ""),
    type: formatJa(String(m.format ?? "")),
    episodes: typeof m.episodes === "number" ? m.episodes : null,
    status: statusJa(String(m.status ?? "")),
    score: typeof m.averageScore === "number" ? m.averageScore / 10 : null,
    synopsis: stripHtml(String(m.description ?? "")),
    genres: (m.genres ?? []).map((g: any) => String(g)),
    studios: (m.studios?.nodes ?? []).map((s: any) => String(s.name ?? "")).filter(Boolean),
    coverUrl: String(cover.extraLarge ?? cover.large ?? ""),
    bannerUrl: String(m.bannerImage ?? ""),
    seasonLabel: seasonLabel(m.season ?? null, m.seasonYear ?? null),
    sourceJa: sourceJa(String(m.source ?? "")),
    nextEpisode: next?.episode ?? null,
    nextAiringAt: next?.airingAt ?? null,
    trailerVideoId,
    trailerThumb: tr?.thumbnail ? String(tr.thumbnail) : null,
    xHandle,
    streaming,
    cast,
    staff,
    relations,
  };
}

// ---- 今期人気（トップ一覧用） ----
export type SeasonAnime = {
  id: number;
  title: string;
  coverUrl: string;
  format: string;
  status: string;
};
function currentSeason(): { season: string; seasonYear: number } {
  const jst = new Date(Date.now() + 9 * 3600 * 1000);
  const m = jst.getUTCMonth() + 1;
  const y = jst.getUTCFullYear();
  if (m <= 3) return { season: "WINTER", seasonYear: y };
  if (m <= 6) return { season: "SPRING", seasonYear: y };
  if (m <= 9) return { season: "SUMMER", seasonYear: y };
  return { season: "FALL", seasonYear: y };
}
const SEASON_QUERY = `
query ($season: MediaSeason, $seasonYear: Int) {
  Page(page: 1, perPage: 40) {
    media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
      id title { native romaji } format status coverImage { large }
    }
  }
}`;
export async function fetchSeasonPopular(): Promise<SeasonAnime[]> {
  const { season, seasonYear } = currentSeason();
  const data = await gql<{ Page: { media: any[] } }>(SEASON_QUERY, { season, seasonYear });
  return (data.Page.media ?? []).map((m) => ({
    id: m.id,
    title: String(m.title?.native ?? m.title?.romaji ?? ""),
    coverUrl: String(m.coverImage?.large ?? ""),
    format: formatJa(String(m.format ?? "")),
    status: statusJa(String(m.status ?? "")),
  }));
}
// ---- 検索（クライアントから呼ぶ・18禁除外） ----
// typeがnull（すべて）のときは type 条件をクエリから外す（type:null だと0件になるため）
export async function searchAnime(
  query: string,
  type: "ANIME" | "MANGA" | null,
  signal?: AbortSignal
): Promise<SeasonAnime[]> {
  if (!query.trim()) return [];
  const typeVar = type ? "$type: MediaType, " : "";
  const typeArg = type ? ", type: $type" : "";
  const gqlQuery = `
query (${typeVar}$search: String) {
  Page(page: 1, perPage: 24) {
    media(search: $search, isAdult: false, sort: SEARCH_MATCH${typeArg}) {
      id title { native romaji } format status coverImage { large }
    }
  }
}`;
  const variables: Record<string, unknown> = { search: query };
  if (type) variables.type = type;
  const res = await fetch(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: gqlQuery, variables }),
    signal,
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const json = await res.json();
  const media = json?.data?.Page?.media ?? [];
  return media.map((m: any) => ({
    id: m.id,
    title: String(m.title?.native ?? m.title?.romaji ?? ""),
    coverUrl: String(m.coverImage?.large ?? ""),
    format: formatJa(String(m.format ?? "")),
    status: statusJa(String(m.status ?? "")),
  }));
}
// ---- 汎用検索（フリーワード＋種別＋状態＋#ジャンルタグ＋ソート・18禁除外） ----
export type SearchOpts = {
  search: string;
  type: "ANIME" | "MANGA" | null;
  status: string | null; // RELEASING / FINISHED / NOT_YET_RELEASED
  genres: string[];
  sort: string; // match / trending / popular / score / new
  season?: boolean; // trueで今期に限定
};
const SORT_MAP: Record<string, string> = {
  match: "SEARCH_MATCH",
  trending: "TRENDING_DESC",
  popular: "POPULARITY_DESC",
  score: "SCORE_DESC",
  new: "START_DATE_DESC",
};
export async function searchMedia(
  opts: SearchOpts,
  signal?: AbortSignal
): Promise<SeasonAnime[]> {
  const { search, type, status, genres, sort } = opts;
  const sortVal =
    sort === "match" && !search ? "POPULARITY_DESC" : SORT_MAP[sort] ?? "SEARCH_MATCH";
  const vars: Record<string, unknown> = { sort: [sortVal], isAdult: false };
  const args = ["sort: $sort", "isAdult: $isAdult"];
  const defs = ["$sort: [MediaSort]", "$isAdult: Boolean"];
  if (search) {
    vars.search = search;
    args.push("search: $search");
    defs.push("$search: String");
  }
  if (type) {
    vars.type = type;
    args.push("type: $type");
    defs.push("$type: MediaType");
  }
  if (status) {
    vars.status = status;
    args.push("status: $status");
    defs.push("$status: MediaStatus");
  }
  if (genres.length > 0) {
    vars.genres = genres;
    args.push("genre_in: $genres");
    defs.push("$genres: [String]");
  }
  if (opts.season) {
    const cs = currentSeason();
    vars.season = cs.season;
    vars.seasonYear = cs.seasonYear;
    args.push("season: $season", "seasonYear: $seasonYear");
    defs.push("$season: MediaSeason", "$seasonYear: Int");
  }
  const q = `query (${defs.join(", ")}) {
  Page(page: 1, perPage: 30) {
    media(${args.join(", ")}) {
      id title { native romaji } format status coverImage { large }
    }
  }
}`;
  const res = await fetch(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: q, variables: vars }),
    signal,
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const json = await res.json();
  const media = json?.data?.Page?.media ?? [];
  return media.map((m: any) => ({
    id: m.id,
    title: String(m.title?.native ?? m.title?.romaji ?? ""),
    coverUrl: String(m.coverImage?.large ?? ""),
    format: formatJa(String(m.format ?? "")),
    status: statusJa(String(m.status ?? "")),
  }));
}

// ---- シリーズ関連作品（前作・続編チェーンをたどって全期・全クールを復元） ----
export type SeriesEntry = {
  id: number;
  title: string;
  format: string;
  episodes: number | null;
  isCurrent: boolean;
};
const RELATIONS_QUERY = `
query ($id: Int) {
  Media(id: $id) {
    id type format episodes status title { native romaji }
    relations { edges { relationType node { id type format status episodes title { native romaji } } } }
  }
}`;
export async function fetchSeriesInfo(
  startId: number
): Promise<{ chain: SeriesEntry[]; related: RelatedWork[]; complete: boolean }> {
  const visited = new Set<number>();
  const chain = new Map<number, SeriesEntry>();
  const related = new Map<number, RelatedWork>();
  const queue: number[] = [startId];
  const TV = new Set(["TV", "TV_SHORT", "ONA"]);
  let complete = true;
  let reqs = 0;
  const MAX_REQ = 14;
  while (queue.length > 0 && reqs < MAX_REQ) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    reqs++;
    let data: { Media?: any } | null = null;
    try {
      const res = await fetch(ANILIST, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: RELATIONS_QUERY, variables: { id } }),
      });
      if (!res.ok) throw new Error(String(res.status));
      data = (await res.json())?.data ?? null;
    } catch {
      complete = false;
      continue;
    }
    const m = data?.Media;
    if (!m) continue;
    if (m.type === "ANIME" && TV.has(m.format)) {
      chain.set(m.id, {
        id: m.id,
        title: String(m.title?.native ?? m.title?.romaji ?? ""),
        format: String(m.format ?? ""),
        episodes: typeof m.episodes === "number" ? m.episodes : null,
        isCurrent: m.id === startId,
      });
    }
    for (const e of m.relations?.edges ?? []) {
      const rel = String(e.relationType ?? "");
      const node = e.node;
      if (!node?.id) continue;
      const isChainEdge =
        (rel === "SEQUEL" || rel === "PREQUEL") && node.type === "ANIME";
      if (isChainEdge) {
        if (!visited.has(node.id)) queue.push(node.id);
      } else if (node.id !== startId) {
        const t = String(node.title?.native ?? node.title?.romaji ?? "");
        if (t && !related.has(node.id)) {
          related.set(node.id, {
            id: node.id,
            title: t,
            relation: relationJa(rel),
            format: String(node.format ?? ""),
            mediaType: String(node.type ?? ""),
          });
        }
      }
    }
  }
  if (queue.length > 0) complete = false;
  return {
    chain: [...chain.values()].sort((a, b) => a.id - b.id),
    related: [...related.values()],
    complete,
  };
}

// AniListのジャンル英名 → 日本語表示（タグ検索用。フィルタは英名で行う）
export const GENRE_JA: Record<string, string> = {
  Action: "アクション",
  Adventure: "冒険",
  Comedy: "コメディ",
  Drama: "ドラマ",
  Ecchi: "エッチ",
  Fantasy: "ファンタジー",
  Horror: "ホラー",
  "Mahou Shoujo": "魔法少女",
  Mecha: "メカ",
  Music: "音楽",
  Mystery: "ミステリー",
  Psychological: "サイコロジカル",
  Romance: "恋愛",
  "Sci-Fi": "SF",
  "Slice of Life": "日常",
  Sports: "スポーツ",
  Supernatural: "超常",
  Thriller: "スリラー",
};
export const genreJa = (g: string) => GENRE_JA[g] ?? g;
/* eslint-enable @typescript-eslint/no-explicit-any */
