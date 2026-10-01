// 今期配信一覧の「公開用」共有データを読む。書き込みは管理者（認証済みサーバー処理）側のみ。
// 公開データ: seasonStreamingPublic/{seasonKey}（親メタ） / .../entries/{entryId}
// ※ candidate・rejected・管理メモ等は seasonStreamingAdmin 側に置き、公開側へはコピーしない。
import { collection, doc, getDoc, getDocs } from "firebase/firestore/lite";
import { db } from "@/lib/firebase";
import { currentSeasonKey, adjacentSeasonKey } from "@/lib/season";

export type Availability =
  | "included" // 見放題
  | "rental" // レンタル
  | "channel" // 追加チャンネル
  | "free" // 無料
  | "unknown";

// 一般公開して良い最小限のフィールドだけを持つ
export type PublicEntry = {
  id: string;
  anilistId: number;
  title: string;
  coverImage: string;
  serviceKey: string;
  serviceName: string;
  availability: Availability;
  firstAvailableAt: number | null; // UNIX秒
  weeklyDay: number | null; // 0=日 .. 6=土
  weeklyTime: string | null; // "23:30"
  isExclusive: boolean;
  isFastest: boolean;
  sourceUrl: string;
  sourceCheckedAt: number | null; // UNIX秒
};

export type SeasonMeta = {
  seasonKey: string;
  label: string;
  confirmedCount: number;
  lastPublishedAt: number | null; // UNIX秒
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function toSec(v: any): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v.seconds === "number") return v.seconds; // Firestore Timestamp(生)
  if (v && typeof v.toDate === "function") return Math.floor(v.toDate().getTime() / 1000);
  return null;
}

export async function getSeasonMeta(seasonKey: string): Promise<SeasonMeta | null> {
  try {
    const snap = await getDoc(doc(db, "seasonStreamingPublic", seasonKey));
    if (!snap.exists()) return null;
    const d = snap.data() as any;
    return {
      seasonKey,
      label: String(d.label ?? ""),
      confirmedCount: Number(d.confirmedCount ?? d.entryCount ?? 0),
      lastPublishedAt: toSec(d.lastPublishedAt ?? d.updatedAt),
    };
  } catch {
    return null;
  }
}

// 公開データが入っている最新シーズンのキーを返す。
//
// なぜ必要か: /streaming は以前「今日の日付から決まる今期」へ無条件に飛ばしていた。
// そのため季節の変わり目（例: 10月1日）に、まだデータを入れていない新シーズンへ飛び、
// 主力ページが空のまま検索結果に出てしまう状態だった。
// 配信各社が新クールのラインナップを公開するのは開始の2〜3週間前なので、
// 「シーズンが変わった瞬間にデータが揃っている」ことは構造的にありえない。
// そこで、今期→1つ前→2つ前…と遡り、実際に公開データがある最新シーズンを選ぶ。
//
// 追加（2026-09-29）：来期の開始 LOOKAHEAD_DAYS 日前からは、来期に公開データがあれば来期を優先する。
// 「◯年秋アニメ どこで見れる」が検索されるのは開始前の2〜3週間なので、
// データを先に公開しても10月1日まで夏のままだった問題を解消する。
const LOOKAHEAD_DAYS = 21;
const SEASON_START_MONTH: Record<string, number> = { winter: 1, spring: 4, summer: 7, fall: 10 };

function seasonStartMs(key: string): number | null {
  const m = /^(\d{4})-(winter|spring|summer|fall)$/.exec(key);
  if (!m) return null;
  const mm = String(SEASON_START_MONTH[m[2]]).padStart(2, "0");
  return new Date(`${m[1]}-${mm}-01T00:00:00+09:00`).getTime();
}

export async function latestSeasonKeyWithData(maxBack = 4): Promise<string> {
  const current = currentSeasonKey();
  const next = adjacentSeasonKey(current, 1);
  const nextStart = seasonStartMs(next);
  if (nextStart !== null && Date.now() >= nextStart - LOOKAHEAD_DAYS * 86400000) {
    const meta = await getSeasonMeta(next);
    if (meta && meta.confirmedCount > 0) return next;
  }
  let key = current;
  for (let i = 0; i <= maxBack; i++) {
    const meta = await getSeasonMeta(key);
    if (meta && meta.confirmedCount > 0) return key;
    key = adjacentSeasonKey(key, -1);
  }
  // どこにもデータが無ければ今期を返す（空の案内文が出る）
  return current;
}

function toEntry(id: string, d: any): PublicEntry | null {
  if (!d || typeof d.anilistId !== "number" || !d.serviceKey) return null;
  return {
    id,
    anilistId: d.anilistId,
    title: String(d.title ?? ""),
    coverImage: String(d.coverImage ?? ""),
    serviceKey: String(d.serviceKey),
    serviceName: String(d.serviceName ?? ""),
    availability: (d.availability ?? "unknown") as Availability,
    firstAvailableAt: toSec(d.firstAvailableAt),
    weeklyDay: typeof d.weeklyDay === "number" ? d.weeklyDay : null,
    weeklyTime: typeof d.weeklyTime === "string" ? d.weeklyTime : null,
    isExclusive: d.isExclusive === true,
    isFastest: d.isFastest === true,
    sourceUrl: String(d.sourceUrl ?? ""),
    sourceCheckedAt: toSec(d.sourceCheckedAt),
  };
}

// 公開エントリー（＝confirmed & published のみ）を全件取得。
//
// 読み取り回数の節約：以前は entries コレクションを毎回全件読んでいた（秋は581件＝1回の表示で581回の読み取り。
// Firestore の無料枠は1日5万回なので、アクセスが増えると課金が始まる作りだった）。
// 今は公開時に親文書 seasonStreamingPublic/{seasonKey} の entries 配列へ全件をまとめて書いているので、
// それを1回読むだけで済む。まとめが無い古いデータのときだけ、従来どおりコレクションを読む。
export async function getPublishedEntries(seasonKey: string): Promise<PublicEntry[]> {
  try {
    const meta = await getDoc(doc(db, "seasonStreamingPublic", seasonKey));
    const packed = meta.exists() ? (meta.data() as any)?.entries : undefined;
    if (Array.isArray(packed)) {
      return packed
        .map((e: any) => toEntry(String(e?.id ?? ""), e))
        .filter((e): e is PublicEntry => e !== null);
    }
    const snap = await getDocs(collection(db, "seasonStreamingPublic", seasonKey, "entries"));
    return snap.docs
      .map((s) => toEntry(s.id, s.data()))
      .filter((e): e is PublicEntry => e !== null);
  } catch {
    return [];
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// 「2026年秋」→ "2026-fall"（AniList の seasonLabel から作品のシーズンを割り出す）
export function seasonKeyFromLabel(label: string): string | null {
  const m = /(\d{4})年(春|夏|秋|冬)/.exec(label || "");
  if (!m) return null;
  const s: Record<string, string> = { 春: "spring", 夏: "summer", 秋: "fall", 冬: "winter" };
  return `${m[1]}-${s[m[2]]}`;
}

// 1作品ぶんの確認済み配信情報。
// 作品ページは「今期」だけでなく、作品自身のシーズンと前後のシーズンも見る
// （公開直後の来期作品や、季節が変わった後の前期作品も表示できるように）。
// 同じサービスが複数シーズンにある場合（2クール作品など）は新しいシーズンを優先する。
export async function getWorkEntries(anilistId: number, seasonKeys: string[]): Promise<PublicEntry[]> {
  const keys = [...new Set(seasonKeys.filter(Boolean))];
  const lists = await Promise.all(keys.map((k) => getPublishedEntries(k).then((l) => ({ k, l }))));
  const order = ["winter", "spring", "summer", "fall"];
  const rank = (k: string) => {
    const [y, s] = k.split("-");
    return Number(y) * 10 + order.indexOf(s);
  };
  lists.sort((a, b) => rank(b.k) - rank(a.k));
  const out = new Map<string, PublicEntry>();
  for (const { l } of lists) {
    for (const e of l) {
      if (e.anilistId === anilistId && !out.has(e.serviceKey)) out.set(e.serviceKey, e);
    }
  }
  return [...out.values()];
}

export const AVAILABILITY_JA: Record<Availability, string> = {
  included: "見放題",
  rental: "レンタル",
  channel: "追加チャンネル",
  free: "無料",
  unknown: "",
};

const WD = ["日", "月", "火", "水", "木", "金", "土"];
export function weeklyLabel(day: number | null, time: string | null): string | null {
  if (day == null) return null;
  return `毎週${WD[day] ?? ""}曜${time ? " " + time : ""}`;
}
