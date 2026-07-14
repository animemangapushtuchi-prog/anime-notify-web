// 登録作品の読み書き。旧Flutter版と同じ users/{uid}.works 配列に保存する。
// サーバー（Cloud Functions）はこの works[].id を見て「登録者だけ」に通知を配る。
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const MAX_SLOTS = 10;

export type Work = {
  id: number; // AniList作品ID
  title: string;
  meta: string;
  status: string; // "RELEASING" | "FINISHED"
  cover?: string;
  added?: number;
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

// 追加（既に登録済み or 枠オーバーなら現状のまま返す）
export async function addWork(uid: string, w: Work): Promise<Work[]> {
  const cur = await getWorks(uid);
  if (cur.some((x) => x.id === w.id)) return cur;
  if (cur.length >= MAX_SLOTS) return cur;
  return saveWorks(uid, [...cur, { ...w, added: Date.now() }]);
}

export async function removeWork(uid: string, id: number): Promise<Work[]> {
  const cur = await getWorks(uid);
  return saveWorks(
    uid,
    cur.filter((x) => x.id !== id)
  );
}
