// 登録作品の読み書き。旧Flutter版と同じ users/{uid}.works 配列に保存する。
// サーバー（Cloud Functions）はこの works[].id を見て「登録者だけ」に通知を配る。
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const BASE_SLOTS = 10;
export const MAX_BONUS_SLOTS = 10;
// 後方互換：基本枠（ボーナス無しの上限）
export const MAX_SLOTS = BASE_SLOTS;

// 累計ログイン日数 → 付与ボーナス枠（初日=0、以降1日ごとに+1、上限 MAX_BONUS_SLOTS）
export function slotBonus(days: number): number {
  return Math.min(Math.max((days ?? 0) - 1, 0), MAX_BONUS_SLOTS);
}
// 累計ログイン日数 → 実効の登録上限
export function slotCap(days: number): number {
  return BASE_SLOTS + slotBonus(days);
}

// 視聴ステータス（Annict風の多段管理）。放送状態(status)とは別軸。
export type WatchStatus = "want" | "watching" | "watched" | "paused" | "dropped";

export const WATCH_STATUSES: {
  key: WatchStatus;
  label: string;
  color: string;
  bg: string;
}[] = [
  { key: "want", label: "見たい", color: "#2563EB", bg: "#E8F0FE" },
  { key: "watching", label: "見てる", color: "#059669", bg: "#E6F7F1" },
  { key: "watched", label: "見た", color: "#7C3AED", bg: "#F1E9FE" },
  { key: "paused", label: "中断", color: "#B45309", bg: "#FEF3C7" },
  { key: "dropped", label: "中止", color: "#6B7280", bg: "#F1F1F5" },
];

export const watchLabel = (s?: WatchStatus): string =>
  WATCH_STATUSES.find((x) => x.key === s)?.label ?? "未選択";

export type Work = {
  id: number; // AniList作品ID
  title: string;
  meta: string;
  status: string; // "RELEASING" | "FINISHED"
  cover?: string;
  episodes?: number; // 総話数（取得できた作品のみ）
  added?: number;
  watchStatus?: WatchStatus; // 見たい/見てる/見た/中断/中止（未設定=未選択）
  watchedEpisode?: number; // 何話まで見たか（未設定=0話）
  // シリーズまとめ表示用（後方互換の任意フィールド。無い作品は従来どおり単独表示）
  seriesId?: number; // 取得できたチェーンの最初の公開作品ID（同じ取得結果で安定）
  seriesTitle?: string;
  seriesOrder?: number; // シリーズ内の公開順の目安
};

export async function getWorks(uid: string): Promise<Work[]> {
  const snap = await getDoc(doc(db, "users", uid));
  return ((snap.data()?.works as Work[] | undefined) ?? []).filter(
    (w) => w && typeof w.id === "number"
  );
}

async function saveWorks(uid: string, works: Work[]): Promise<Work[]> {
  await setDoc(
    doc(db, "users", uid),
    { works, updatedAt: serverTimestamp() },
    { merge: true }
  );
  return works;
}

// 追加（既に登録済み or 枠オーバーなら現状のまま返す）。
// 上限は基本枠＋ログインボーナス（users/{uid}.login.days から算出）。
export async function addWork(uid: string, w: Work): Promise<Work[]> {
  const snap = await getDoc(doc(db, "users", uid));
  const data = snap.data() ?? {};
  const cur = ((data.works as Work[] | undefined) ?? []).filter(
    (x) => x && typeof x.id === "number"
  );
  if (cur.some((x) => x.id === w.id)) return cur;
  const cap = slotCap((data.login as { days?: number } | undefined)?.days ?? 0);
  if (cur.length >= cap) return cur;
  return saveWorks(uid, [...cur, { ...w, added: Date.now() }]);
}

// Firestoreはundefinedを保存できないため、undefinedのキーを取り除く
function cleanWork(w: Work): Work {
  const c = { ...w } as Record<string, unknown>;
  for (const k of Object.keys(c)) if (c[k] === undefined) delete c[k];
  return c as Work;
}

export type AddWorksResult = {
  works: Work[]; // 更新後（未変更時は現状）の一覧
  addedIds: number[]; // 実際に追加したID
  alreadyIds: number[]; // すでに登録済みだったID
  needed: number; // 新規に必要だった枠数
  free: number; // 追加前の空き枠数
  blocked: boolean; // 枠不足で未変更だったか
};

// 複数作品の一括追加。ユーザードキュメントの取得・保存は各1回。
// 枠不足時は一件も追加せずに返す（部分登録しない）。
// 既存作品にはシリーズ情報だけを補完し、視聴状態・話数・追加日時は保持する。
export async function addWorks(uid: string, candidates: Work[]): Promise<AddWorksResult> {
  const snap = await getDoc(doc(db, "users", uid));
  const data = snap.data() ?? {};
  const cur = ((data.works as Work[] | undefined) ?? []).filter(
    (x) => x && typeof x.id === "number"
  );
  const cap = slotCap((data.login as { days?: number } | undefined)?.days ?? 0);
  const free = Math.max(0, cap - cur.length);

  // 候補の重複IDを除去
  const seen = new Set<number>();
  const uniq: Work[] = [];
  for (const c of candidates) {
    if (c && typeof c.id === "number" && !seen.has(c.id)) {
      seen.add(c.id);
      uniq.push(c);
    }
  }
  const curIds = new Set(cur.map((w) => w.id));
  const newOnes = uniq.filter((c) => !curIds.has(c.id));
  const alreadyIds = uniq.filter((c) => curIds.has(c.id)).map((c) => c.id);
  const needed = newOnes.length;

  if (needed > free) {
    return { works: cur, addedIds: [], alreadyIds, needed, free, blocked: true };
  }

  // 既存作品へシリーズ情報を補完（ユーザー固有の値は上書きしない）
  const byId = new Map(uniq.map((c) => [c.id, c]));
  let seriesChanged = false;
  const merged = cur.map((w) => {
    const c = byId.get(w.id);
    if (!c || typeof c.seriesId !== "number") return w;
    if (w.seriesId === c.seriesId && w.seriesOrder === c.seriesOrder && w.seriesTitle === c.seriesTitle) return w;
    seriesChanged = true;
    const copy: Work = { ...w, seriesId: c.seriesId };
    if (c.seriesTitle !== undefined) copy.seriesTitle = c.seriesTitle;
    if (c.seriesOrder !== undefined) copy.seriesOrder = c.seriesOrder;
    return copy;
  });

  if (needed === 0 && !seriesChanged) {
    return { works: cur, addedIds: [], alreadyIds, needed, free, blocked: false };
  }

  const now = Date.now();
  const additions = newOnes.map((c) => cleanWork({ ...c, added: now }));
  const next = [...merged.map(cleanWork), ...additions];
  await saveWorks(uid, next);
  return { works: next, addedIds: additions.map((a) => a.id), alreadyIds, needed, free, blocked: false };
}

export async function removeWork(uid: string, id: number): Promise<Work[]> {
  const cur = await getWorks(uid);
  return saveWorks(
    uid,
    cur.filter((x) => x.id !== id)
  );
}

// 視聴ステータスを設定（null=未選択に戻す）。Firestoreはundefined不可なのでキーごと削除。
export async function setWatchStatus(
  uid: string,
  id: number,
  status: WatchStatus | null
): Promise<Work[]> {
  const cur = await getWorks(uid);
  const next = cur.map((w) => {
    if (w.id !== id) return w;
    const c: Work = { ...w };
    if (status) c.watchStatus = status;
    else delete c.watchStatus;
    return c;
  });
  return saveWorks(uid, next);
}

// 視聴済み話数を保存（0話は未記録としてキーごと削除）。
export async function setWatchedEpisode(
  uid: string,
  id: number,
  episode: number
): Promise<Work[]> {
  const value = Math.max(0, Math.floor(episode));
  const cur = await getWorks(uid);
  const next = cur.map((w) => {
    if (w.id !== id) return w;
    const copy: Work = { ...w };
    if (value > 0) copy.watchedEpisode = value;
    else delete copy.watchedEpisode;
    return copy;
  });
  return saveWorks(uid, next);
}
