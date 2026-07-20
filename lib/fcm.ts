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

// この端末の現在のトークンを（許可済みの場合のみ）取得する。ダイアログは出ない。
// ページ再読み込みでメモリ上の _currentToken が消えていても特定できるようにする。
async function resolveCurrentToken(messaging: Messaging | null): Promise<string | null> {
  if (_currentToken) return _currentToken;
  if (!messaging) return null;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return null;
  try {
    return (await getToken(messaging, { vapidKey: VAPID_KEY })) || null;
  } catch {
    return null;
  }
}

// ログアウト時：この端末のトークン登録を消してから deleteToken
export async function unregisterPush(): Promise<void> {
  try {
    const messaging = await getMessagingSafe();
    const token = await resolveCurrentToken(messaging);
    if (token) {
      await deleteDoc(doc(db, "tokens", token)).catch(() => {});
    }
    if (messaging) await fbDeleteToken(messaging).catch(() => {});
  } catch {
    /* noop */
  }
  _currentToken = null;
}

// 通知の再設定：この端末のトークンだけを 削除→再取得→再保存 する
export async function resetPush(uid: string): Promise<PushStatus> {
  if (typeof Notification === "undefined") return "unsupported";
  // 拒否済みのときは再許可を試みない（ブラウザ設定の変更が必要）
  if (Notification.permission !== "granted") return "denied";
  const messaging = await getMessagingSafe();
  if (!messaging) return "unsupported";
  try {
    const token = await resolveCurrentToken(messaging);
    if (token) await deleteDoc(doc(db, "tokens", token)).catch(() => {});
    await fbDeleteToken(messaging).catch(() => {});
    _currentToken = null;
    return await registerPushToken(uid);
  } catch {
    return "error";
  }
}

// 通知用Service Worker（firebase-messaging-sw.js）の登録を探す
async function getPushSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    return (
      regs.find((r) => {
        const sw = r.active ?? r.waiting ?? r.installing;
        return sw ? sw.scriptURL.includes("firebase-messaging-sw.js") : false;
      }) ?? null
    );
  } catch {
    return null;
  }
}

export type PushOverall = "ready" | "permission-required" | "blocked" | "unsupported" | "error";
export type PushDiagnosis = {
  supported: boolean; // Firebase Messaging とブラウザ通知に対応しているか
  permission: NotificationPermission | "unsupported";
  serviceWorkerReady: boolean; // 通知用Service Workerが利用可能か
  tokenRegistered: boolean; // トークンを取得し tokens/{token} へ保存できたか
  status: PushOverall; // 画面表示用の総合状態
};

// この端末の通知状態を診断する。許可ダイアログは絶対に出さない
// （getToken は permission === "granted" のときにしか呼ばない）。
export async function diagnosePush(uid: string): Promise<PushDiagnosis> {
  const d: PushDiagnosis = {
    supported: false,
    permission: "unsupported",
    serviceWorkerReady: false,
    tokenRegistered: false,
    status: "unsupported",
  };
  try {
    if (typeof window === "undefined" || typeof Notification === "undefined") return d;
    if (!("serviceWorker" in navigator)) return d;
    const messaging = await getMessagingSafe();
    if (!messaging) return d;
    d.supported = true;
    d.permission = Notification.permission;
    d.serviceWorkerReady = (await getPushSwRegistration()) !== null;
    if (d.permission === "denied") {
      d.status = "blocked";
      return d;
    }
    if (d.permission === "default") {
      d.status = "permission-required";
      return d;
    }
    // 許可済み：トークン取得とFirestore保存まで確認（ダイアログは出ない）
    const r = await registerPushToken(uid);
    d.tokenRegistered = r === "enabled";
    if (!d.serviceWorkerReady) d.serviceWorkerReady = (await getPushSwRegistration()) !== null;
    d.status = d.tokenRegistered ? "ready" : "error";
    return d;
  } catch {
    // 診断自体の失敗で画面を壊さない
    if (d.supported && d.permission === "granted") d.status = "error";
    return d;
  }
}

export type PushTestResult = "shown" | "blocked" | "unsupported" | "error";

// 端末内の表示テスト：Service Worker の showNotification でテスト通知を出す。
// これはこの端末で通知を表示できるかの確認であり、サーバー配信のテストではない。
export async function showLocalTestNotification(): Promise<PushTestResult> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "granted") return "blocked";
  try {
    let reg = await getPushSwRegistration();
    if (!reg && "serviceWorker" in navigator) {
      reg = (await navigator.serviceWorker.getRegistration()) ?? null;
    }
    if (!reg) return "error";
    await reg.showNotification("アニミル！通知テスト", {
      body: "この端末では通知を表示できます。",
      icon: "/icon-192.png",
      tag: "animiru-local-test", // 連打しても重複表示しない
      data: { url: "/notifications" },
    });
    return "shown";
  } catch {
    return "error";
  }
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
