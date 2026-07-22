// ログインボーナス：累計ログイン日数(JST)を users/{uid}.login に記録し、登録枠の上限を算出する。
// 途切れてもリセットしない（優しい方式）。初日=+0、2日目以降1日ごとに+1、最大 MAX_BONUS_SLOTS(5)。
// メール認証済み（member/legacy）だけが対象。ゲスト・メール確認待ちでは呼ばないこと。
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { slotCap, slotBonus, MAX_BONUS_SLOTS, MEMBER_BASE_SLOTS } from "@/lib/works";

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
// 複数タブの同時実行で二重加算しないようトランザクションで読み書きする。
// ボーナスが最大に達した後は、不要な書き込みを繰り返さない。
export async function recordLogin(uid: string): Promise<LoginResult> {
  const ref = doc(db, "users", uid);
  try {
    const r = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const login = (snap.data()?.login ?? {}) as { days?: number; lastDay?: string };
      let days = login.days ?? 0;
      let gainedToday = false;
      const today = todayJST();
      if (login.lastDay !== today && slotBonus(days) < MAX_BONUS_SLOTS) {
        days += 1;
        gainedToday = true;
        tx.set(
          ref,
          { login: { days, lastDay: today }, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }
      return { days, gainedToday };
    });
    return { days: r.days, cap: slotCap(r.days), bonus: slotBonus(r.days), gainedToday: r.gainedToday };
  } catch {
    /* オフライン等は無視。既定枠で継続 */
    return { days: 0, cap: MEMBER_BASE_SLOTS, bonus: 0, gainedToday: false };
  }
}
