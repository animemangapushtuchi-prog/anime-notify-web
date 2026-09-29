// 公式サイトの文章から、国内の配信サービス・配信開始日・更新曜日・時刻を取り出す（サーバー専用・無料）。
// AIは使わず、決まったパターンで読む。
//
// 「推測で書かない」ための方針
// - サービスは、ページに名前が書かれているものだけ
// - 日付・曜日・時刻は、そのサービス名と同じ行（または直後の行）に書かれている場合だけ取る
// - 1行に複数のサービスが並ぶ行は、日付がどのサービスのものか断定できないので、サービス名だけ取る
// - 前のシーズン（「第1期 配信中」など）の行は使わない
// - 各行には、見つけた元の文（根拠）を付ける。確認するのは人間
//
// このファイルは外部ライブラリや @/ の別名を実行時には使わない（単体でも動作確認できるように）。
import type { OfficialPage } from "./officialSite";

export type ExtractedRow = {
  anilistId: number;
  title: string;
  serviceKey: string;
  availability: "included" | "rental" | "free" | "unknown";
  firstAvailableAt: number | null;
  weeklyDay: number | null;
  weeklyTime: string | null;
  isExclusive: boolean;
  isFastest: boolean;
  sourceUrl: string;
  sourceLabel: string;
  sourceType: "official-site";
};

export type ExtractResult = {
  rows: ExtractedRow[];
  excluded: number; // 前シーズンの案内などで使わなかった行の数
};

// ページ上の表記ゆれを含むサービス名（serviceKey は lib/streaming.ts の SERVICE_DEFS と同じ）
const SERVICES: { key: string; re: RegExp }[] = [
  { key: "prime-video", re: /Prime\s*Video|プライム\s*[・･]?\s*ビデオ|Amazon\s*Prime|アマゾン\s*プライム/i },
  { key: "netflix", re: /Netflix|ネットフリックス/i },
  { key: "u-next", re: /U-?NEXT/i },
  { key: "d-anime", re: /d\s*アニメ\s*ストア|dアニメ/i },
  { key: "abema", re: /ABEMA|アベマ/i },
  { key: "hulu", re: /Hulu/i },
  { key: "dmm-tv", re: /DMM\s*TV/i },
  { key: "lemino", re: /Lemino/i },
  { key: "fod", re: /(?<![A-Za-z])FOD(?![A-Za-z])/ },
  { key: "telasa", re: /TELASA|テラサ/i },
  { key: "disney-plus", re: /Disney\s*(\+|＋|Plus)|ディズニー\s*(プラス|\+|＋)/i },
  { key: "niconico", re: /ニコニコ|niconico/i },
  { key: "bandai-channel", re: /バンダイチャンネル/ },
  { key: "anime-times", re: /アニメタイムズ/ },
];

// 「dアニメストア for Prime Video」「〇〇 Prime Video チャンネル」は Prime Video 内の別料金チャンネル。
// これを Prime Video 本体の配信と取り違えないよう、Prime Video の判定からは除いて読む
const PRIME_CHANNEL = /for\s*Prime\s*Video|Prime\s*Video\s*チャンネル|プライム\s*ビデオ\s*チャンネル/gi;

function hasService(s: { key: string; re: RegExp }, line: string): boolean {
  const target = s.key === "prime-video" ? line.replace(PRIME_CHANNEL, " ") : line;
  return s.re.test(target);
}

// 本編の配信ではない案内（特番・PV・一挙放送・YouTube公開・グッズなど）の行は使わない
const NOT_EPISODE =
  /特番|直前|特別番組|PV|予告|先行上映|上映会|イベント|一挙|振り返り|YouTube|グッズ|Blu-?ray|DVD|キャンペーン|プレゼント/i;

// お知らせ欄の先頭にある掲載日（「2026/09/28 …」「2026.09.28 …」）は配信日ではないので外して読む
const NEWS_DATE = /^\s*20\d{2}\s*[./年]\s*\d{1,2}\s*[./月]\s*\d{1,2}\s*日?\s+/;

const WD: Record<string, number> = { 日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6 };

// 作品タイトルから「何期目か」を読む（第3期 / Season 2 / 2nd Season / Ⅱ / II / 末尾の数字）
export function seasonNumberOf(title: string): number {
  const t = title.normalize("NFKC");
  const m =
    /第\s*(\d+)\s*期/.exec(t) ??
    /season\s*(\d+)/i.exec(t) ??
    /(\d+)\s*(?:st|nd|rd|th)\s*season/i.exec(t);
  if (m) return Number(m[1]);
  const roman: Record<string, number> = { II: 2, III: 3, IV: 4, V: 5 };
  const r = /(?:^|[^A-Z])(II|III|IV|V)\s*$/.exec(t.trim());
  if (r) return roman[r[1]];
  const kanji = /第([一二三四五])期/.exec(t);
  if (kanji) return "一二三四五".indexOf(kanji[1]) + 1;
  return 1;
}

// 前のシーズンについての行か（例：対象が第3期のとき「第1期・第2期 好評配信中」）
function mentionsEarlierSeason(line: string, target: number): boolean {
  if (target <= 1) return false;
  const t = line.normalize("NFKC");
  const nums = [
    ...[...t.matchAll(/第\s*(\d+)\s*期/g)].map((m) => Number(m[1])),
    ...[...t.matchAll(/season\s*(\d+)/gi)].map((m) => Number(m[1])),
    ...[...t.matchAll(/(\d+)\s*(?:st|nd|rd|th)\s*season/gi)].map((m) => Number(m[1])),
  ];
  if (/前作|前シリーズ|シリーズ一挙|一挙配信/.test(t)) return true;
  // 対象の期が出てこず、それより前の期だけが出てくる行は前シーズンの案内とみなす
  return nums.length > 0 && !nums.includes(target) && nums.every((n) => n < target);
}

type Parsed = {
  date: { y: number | null; m: number; d: number } | null;
  weeklyDay: number | null;
  time: string | null;
};

function parseSchedule(line: string): Parsed {
  const t = line.normalize("NFKC");
  let date: Parsed["date"] = null;
  const ymd = /(20\d{2})\s*[年./]\s*(\d{1,2})\s*[月./]\s*(\d{1,2})\s*日?/.exec(t);
  const md =
    /(\d{1,2})\s*月\s*(\d{1,2})\s*日/.exec(t) ??
    // 「10/3(土)」形式は、曜日の括弧が続くときだけ日付とみなす（分数などの誤読を避ける）
    /(?<![\d/])(\d{1,2})\/(\d{1,2})\s*[(（][日月火水木金土]/.exec(t);
  if (ymd) date = { y: Number(ymd[1]), m: Number(ymd[2]), d: Number(ymd[3]) };
  else if (md) date = { y: null, m: Number(md[1]), d: Number(md[2]) };
  if (date && (date.m < 1 || date.m > 12 || date.d < 1 || date.d > 31)) date = null;

  // 曜日は「毎週」と明記されているときだけ（単発の日付の曜日を毎週扱いしない）
  let weeklyDay: number | null = null;
  const w = /毎週\s*[(（]?\s*([日月火水木金土])/.exec(t);
  if (w) weeklyDay = WD[w[1]];

  // 時刻は、日付か「毎週」がある行でだけ読む（関係ない数字を拾わない）
  let time: string | null = null;
  if (date || weeklyDay !== null) {
    const hm = /(\d{1,2})\s*[:時]\s*(\d{2})\s*分?/.exec(t);
    const h = /(\d{1,2})\s*時(?!間)/.exec(t);
    if (/正午/.test(t)) time = "12:00";
    else if (hm) time = `${hm[1].padStart(2, "0")}:${hm[2]}`;
    else if (h) time = `${h[1].padStart(2, "0")}:00`;
    // 「木曜深夜0時30分」は放送の慣習で「木曜 24:30」（金曜の午前0時30分）を指す。曜日と組で使うため 24時台に直す
    if (time && /深夜/.test(t) && Number(time.slice(0, 2)) <= 5) {
      time = `${Number(time.slice(0, 2)) + 24}:${time.slice(3)}`;
    }
    if (time && Number(time.slice(0, 2)) > 29) time = null;
  }
  return { date, weeklyDay, time };
}

function availabilityOf(line: string): ExtractedRow["availability"] {
  if (/見放題/.test(line)) return "included";
  if (/レンタル|都度課金|個別課金/.test(line)) return "rental";
  if (/無料(?!体験|トライアル|期間|お試し)/.test(line)) return "free";
  return "unknown";
}

function toSec(y: number, m: number, d: number): number {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return Math.floor(new Date(`${y}-${mm}-${dd}T00:00:00+09:00`).getTime() / 1000);
}

// 年が省略された日付に、対象シーズンの年を補う（冬アニメの前年12月の先行配信にも対応）
function resolveYear(m: number, season: { year: number; season: string }): number {
  if (season.season === "winter" && m >= 10) return season.year - 1;
  return season.year;
}

// 対象シーズンの期間（前後に少し余裕を持たせる）。これを外れる日付が書かれた行は、
// 過去シーズンや別企画の案内とみなして使わない（例：公式サイトに残っている前作の配信予定）
const SEASON_START_MONTH: Record<string, number> = { winter: 1, spring: 4, summer: 7, fall: 10 };
function inSeasonWindow(sec: number, season: { year: number; season: string }): boolean {
  const m = SEASON_START_MONTH[season.season] ?? 1;
  const start = toSec(season.year, m, 1);
  const end = toSec(m === 10 ? season.year + 1 : season.year, m === 10 ? 1 : m + 3, 1);
  return sec >= start - 60 * 86400 && sec < end + 31 * 86400;
}

function quote(line: string, re: RegExp): string {
  const s = line.normalize("NFKC");
  if (s.length <= 80) return s;
  const i = Math.max(0, (re.exec(s)?.index ?? 0) - 30);
  return s.slice(i, i + 80);
}

export function extractStreaming(opts: {
  anilistId: number;
  title: string;
  season: { year: number; season: string };
  pages: OfficialPage[];
}): ExtractResult {
  const target = seasonNumberOf(opts.title);
  const best = new Map<string, { row: ExtractedRow; score: number }>();
  let excluded = 0;

  for (const page of opts.pages) {
    const lines = page.text.split("\n");
    lines.forEach((rawLine, i) => {
      const line = rawLine.replace(NEWS_DATE, "");
      const hits = SERVICES.filter((s) => hasService(s, line));
      if (hits.length === 0) return;
      if (NOT_EPISODE.test(line)) {
        excluded += hits.length;
        return;
      }
      if (mentionsEarlierSeason(line, target)) {
        excluded += hits.length;
        return;
      }

      // 日付などは、サービスが1つだけの行で読む。
      // その行に日付が無ければ、サービス名を含まない直後の1行も見る（表の「サービス名／日時」の並び）
      let sched: Parsed = { date: null, weeklyDay: null, time: null };
      let evidenceLine = line;
      if (hits.length === 1) {
        sched = parseSchedule(line);
        const next = lines[i + 1];
        if (!sched.date && sched.weeklyDay === null && next && !SERVICES.some((s) => hasService(s, next))) {
          const n = parseSchedule(next);
          if (n.date || n.weeklyDay !== null) {
            sched = n;
            evidenceLine = `${line} ${next}`;
          }
        }
      }

      for (const s of hits) {
        const single = hits.length === 1;
        const row: ExtractedRow = {
          anilistId: opts.anilistId,
          title: opts.title,
          serviceKey: s.key,
          availability: single ? availabilityOf(evidenceLine) : "unknown",
          firstAvailableAt:
            single && sched.date
              ? toSec(sched.date.y ?? resolveYear(sched.date.m, opts.season), sched.date.m, sched.date.d)
              : null,
          weeklyDay: single ? sched.weeklyDay : null,
          weeklyTime: single ? sched.time : null,
          isExclusive: single && /独占/.test(evidenceLine),
          isFastest: single && /最速/.test(evidenceLine),
          sourceUrl: page.url,
          sourceLabel: `公式サイト：「${quote(single ? evidenceLine : line, s.re)}」`,
          sourceType: "official-site",
        };
        if (row.firstAvailableAt !== null && !inSeasonWindow(row.firstAvailableAt, opts.season)) {
          excluded++;
          continue;
        }
        // 同じサービスが何度も出てくる場合は、情報が多い行を採用する
        const score =
          (row.firstAvailableAt ? 4 : 0) + (row.weeklyDay !== null ? 2 : 0) + (row.weeklyTime ? 1 : 0) +
          (row.availability !== "unknown" ? 1 : 0) + (/配信/.test(line) ? 1 : 0);
        const cur = best.get(s.key);
        if (!cur || score > cur.score) best.set(s.key, { row, score });
      }
    });
  }

  return { rows: [...best.values()].map((b) => b.row), excluded };
}
