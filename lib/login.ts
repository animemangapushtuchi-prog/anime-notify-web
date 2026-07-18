// ログインボーナス：累計ログイン日数(JST)を users/{uid}.login に記録し、登録枠の上限を算出する。
// 途切れてもリセットしない（優しい方式）。初日=+0、以降1日ごとに+1、最大 MAX_BONUS_SLOTS。
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { slotCap, slotBonus } from "@/lib/works";

function todayJST(): string {
  // JST基準のカレンダー日付（YYYY-MM-DD）
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export type LoginResult = {
  days: number;
  cap: number;
  bonus: number;
  gainedToday: boolean;
};

// アプリ起動時に1回呼ぶ。今日まだ数えていなければ日数を+1して保存する。
export async function recordLogin(uid: string): Promise<LoginResult> {
  const ref = doc(db, "users", uid);
  let days = 0;
  let gainedToday = false;
  try {
    const snap = await getDoc(ref);
    const login = (snap.data()?.login ?? {}) as { days?: number; lastDay?: string };
    days = login.days ?? 0;
    const today = todayJST();
    if (login.lastDay !== today) {
      days += 1;
      gainedToday = true;
      await setDoc(
        ref,
        { login: { days, lastDay: today }, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
  } catch {
    /* オフライン等は無視。既定枠で継続 */
  }
  return { days, cap: slotCap(days), bonus: slotBonus(days), gainedToday };
}
