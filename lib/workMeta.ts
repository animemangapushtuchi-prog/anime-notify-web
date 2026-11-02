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

// AniList の別名から、日本の読者に意味があるものだけを選ぶ（2026-11-03）。
// AniList の synonyms には各国語の題名が混ざる。漢字だけの別名は中国語の題名と見分けられないので使わず、
// かな・カナを含むもの（「青ブタ」「デスノート」など）だけを残す。推測で略称を作らない
const KANA = /[ぁ-ゖァ-ヺー]/;
const HANGUL = /[가-힣]/;
const sameName = (a: string, b: string) => {
  const n = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[\s　]/g, "");
  return n(a) === n(b);
};

export function pickAltNames(title: string, synonyms: string[], max = 4): string[] {
  const out: string[] = [];
  for (const raw of synonyms) {
    const s = raw.trim();
    if (!KANA.test(s) || HANGUL.test(s) || s.length < 2 || s.length > 40) continue;
    if (sameName(s, title) || out.some((x) => sameName(x, s))) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

// 作品ページの「よくある質問」。確認済みのデータと番組表だけから文章を作る（見ていない作品の評価は書かない）
export type FaqRow = Row &
  Pick<PublicEntry, "availability" | "weeklyDay" | "weeklyTime" | "isFastest" | "sourceCheckedAt">;
export type FaqSlot = { ch: string; weekday: number; hhmm: string };
export type Faq = { q: string; a: string };

const WD = ["日", "月", "火", "水", "木", "金", "土"];
const names = (list: { serviceName: string }[]) => list.map((e) => e.serviceName).join("・");

export function workFaq(
  w: { title: string; status: string; episodes: number | null; isSeries: boolean },
  rows: FaqRow[],
  slots: FaqSlot[],
  nowSec = Math.floor(Date.now() / 1000)
): Faq[] {
  const out: Faq[] = [];
  const list = orderServices(rows);
  const upcoming = isUpcoming(list, w.status, nowSec);

  if (list.length > 0) {
    const checked = latestCheckedLabel(list);
    const onlyOne = list.length === 1 && !list[0].isExclusive;
    out.push({
      q: `「${w.title}」はどこで見られますか？`,
      a: `${names(list)}で${upcoming ? "配信予定です" : "配信されています"}${checked ? `（${checked}確認）` : ""}。${onlyOne ? "ほかのサービスでも配信されている場合があります。" : ""}`,
    });
  }

  const exclusive = list.filter((e) => e.isExclusive);
  if (exclusive.length > 0) {
    out.push({
      q: `「${w.title}」は独占配信ですか？`,
      a: `はい。${names(exclusive)}の独占配信として案内されています。`,
    });
  }

  const free = list.filter((e) => e.availability === "free");
  const included = list.filter((e) => e.availability === "included");
  if (free.length > 0) {
    out.push({
      q: `「${w.title}」は無料で見られますか？`,
      a: `${names(free)}で無料配信の案内があります。無料の範囲は話数や期間で変わることがあるので、見る前に各サービスで確かめてください。`,
    });
  }
  if (included.length > 0) {
    out.push({
      q: `「${w.title}」が見放題のサービスはどこですか？`,
      a: `${names(included)}が見放題です。見放題の期間は変わることがあります。`,
    });
  }

  const dated = list
    .filter((e) => e.firstAvailableAt != null && e.firstAvailableAt > nowSec)
    .sort((a, b) => a.firstAvailableAt! - b.firstAvailableAt!);
  if (dated.length > 0) {
    out.push({
      q: `「${w.title}」はいつから配信されますか？`,
      a: `${dated[0].serviceName}で${jstDateLabel(dated[0].firstAvailableAt!)}から配信される予定です。`,
    });
  }

  const weekly = list.filter((e) => e.weeklyDay != null);
  if (weekly.length > 0 && w.status !== "放送終了") {
    const fastest = weekly.find((e) => e.isFastest) ?? weekly[0];
    const when = (e: FaqRow) => `毎週${WD[e.weeklyDay!]}曜${e.weeklyTime ? ` ${e.weeklyTime}` : ""}`;
    out.push({
      q: `「${w.title}」の配信は毎週いつ更新されますか？`,
      a: `${fastest.isFastest ? "最速は" : ""}${fastest.serviceName}${fastest.isFastest ? "で、" : "は"}${when(fastest)}です。サービスによって更新の時間は異なります。`,
    });
  }

  if (slots.length > 0) {
    const seen = new Set<string>();
    const first = slots.filter((s) => (seen.has(s.ch) ? false : (seen.add(s.ch), true)));
    const head = first.slice(0, 3).map((s) => `${s.ch}（毎週${WD[s.weekday]}曜 ${s.hhmm}〜）`).join("、");
    out.push({
      q: `「${w.title}」のテレビ放送はいつですか？`,
      a: `${head}${first.length > 3 ? `ほか${first.length - 3}局` : ""}で放送されています。深夜の時刻は「25:00」のように表しています。`,
    });
  }

  if (w.isSeries && w.status === "放送終了" && w.episodes != null && w.episodes > 1) {
    out.push({ q: `「${w.title}」は全何話ですか？`, a: `全${w.episodes}話です（AniList の登録情報）。` });
  }

  return out;
}
