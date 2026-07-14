// FCM Web Push。トークンを tokens/{token} に登録（旧Flutter版と同一スキーマ）し、
// サーバーの絞り込み配信をそのまま受ける。前面（アプリを見ている最中）は onMessage で自前表示。
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  deleteToken as fbDeleteToken,
  type Messaging,
} from "firebase/messaging";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { app, db, VAPID_KEY } from "@/lib/firebase";

let _messaging: Messaging | null = null;
let _currentToken: string | null = null;

async function getMessagingSafe(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  try {
    if (!(await isSupported())) return null;
  } catch {
    return null;
  }
  if (!_messaging) _messaging = getMessaging(app);
  return _messaging;
}

export type PushStatus = "enabled" | "denied" | "unsupported" | "error";

// 許可済みのときだけ静かにトークンを登録/更新（ログイン時に呼ぶ）
export async function registerPushToken(uid: string): Promise<PushStatus> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "granted") return "denied";
  const messaging = await getMessagingSafe();
  if (!messaging) return "unsupported";
  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return "error";
    _currentToken = token;
    await setDoc(doc(db, "tokens", token), {
      uid,
      platform: "web",
      updatedAt: serverTimestamp(),
    });
    return "enabled";
  } catch {
    return "error";
  }
}

// 許可を求めてから登録（ユーザー操作＝ボタンから呼ぶ）
export async function requestAndRegisterPush(uid: string): Promise<PushStatus> {
  if (typeof Notification === "undefined") return "unsupported";
  const messaging = await getMessagingSafe();
  if (!messaging) return "unsupported";
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  return registerPushToken(uid);
}

// ログアウト時：この端末のトークン登録を消してから deleteToken
export async function unregisterPush(): Promise<void> {
  try {
    if (_currentToken) {
      await deleteDoc(doc(db, "tokens", _currentToken)).catch(() => {});
    }
    const messaging = await getMessagingSafe();
    if (messaging) await fbDeleteToken(messaging).catch(() => {});
  } catch {
    /* noop */
  }
  _currentToken = null;
}

// 前面通知の購読（アプリを見ている最中の通知をトーストで出すため）
export async function subscribeForeground(
  cb: (title: string, body: string) => void
): Promise<() => void> {
  const messaging = await getMessagingSafe();
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    cb(payload.notification?.title ?? "アニメ新着情報", payload.notification?.body ?? "");
  });
}
