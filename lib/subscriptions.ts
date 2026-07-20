// 契約中の配信サービス：設定の読み込み共有キャッシュと、AniListサービス名との対応判定。
// users/{uid} をページ内で何度も読まないよう、1回の読み込みを各コンポーネントで共有する。
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// 設定画面で選べるサービス（settings.services のキー）
export const SERVICE_KEYS = ["dアニメストア", "ABEMA（プレミアム）", "Netflix", "Prime Video", "U-NEXT"];

export type UserPrefs = {
  channels: string[]; // 視聴できるテレビ放送局
  services: string[]; // 契約中としてONにした配信サービスのキー
};

let cache: { uid: string; promise: Promise<UserPrefs> } | null = null;

// 設定を保存したときに呼び、次回アクセスで最新を読み直す
export function invalidateUserPrefs() {
  cache = null;
}

// users/{uid} の settings を1回だけ読む（同一uidの間はキャッシュを共有）
export function getUserPrefs(uid: string): Promise<UserPrefs> {
  if (cache && cache.uid === uid) return cache.promise;
  const promise = (async (): Promise<UserPrefs> => {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      const st = snap.data()?.settings as
        | { channels?: unknown; services?: Record<string, boolean> }
        | undefined;
      const channels = Array.isArray(st?.channels) ? (st.channels as string[]) : [];
      const services = Object.entries(st?.services ?? {})
        .filter(([, v]) => v === true)
        .map(([k]) => k);
      return { channels, services };
    } catch {
      // 取得失敗時はキャッシュを残さず、空（＝従来表示）で返す
      cache = null;
      return { channels: [], services: [] };
    }
  })();
  cache = { uid, promise };
  return promise;
}

// 設定キーごとの、AniListサービス名（site）との対応判定（小文字で比較）
const KEY_MATCHERS: Record<string, (s: string) => boolean> = {
  "dアニメストア": (s) => s.includes("d anime") || s.includes("danime") || s.includes("dアニメ"),
  "ABEMA（プレミアム）": (s) => s.includes("abema"),
  Netflix: (s) => s.includes("netflix"),
  "Prime Video": (s) => s.includes("prime") || s === "amazon",
  "U-NEXT": (s) => s.includes("u-next") || s.includes("unext"),
};

// サービス名が契約中キーのいずれかに該当するか
export function isSubscribedService(site: string, keys: string[]): boolean {
  const s = site.toLowerCase();
  return keys.some((k) => KEY_MATCHERS[k]?.(s) ?? false);
}

// 契約中サービスを先頭へ移動（元の順序は保つ安定並べ替え）
export function sortSubscribedFirst<T>(items: T[], getName: (t: T) => string, keys: string[]): T[] {
  if (keys.length === 0) return items;
  const sub: T[] = [];
  const rest: T[] = [];
  for (const it of items) (isSubscribedService(getName(it), keys) ? sub : rest).push(it);
  return [...sub, ...rest];
}
