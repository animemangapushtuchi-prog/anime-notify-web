// Firebase 初期化（既存プロジェクト anime-notify-app-86ccc をそのまま利用）
// これらは公開Web設定（旧Flutter版のバンドルにも同梱されていた値）。秘密情報ではない。
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBG0jHsv1_JH2sbkwZSHOMDt7zoWPu6_iQ",
  authDomain: "anime-notify-app-86ccc.firebaseapp.com",
  projectId: "anime-notify-app-86ccc",
  storageBucket: "anime-notify-app-86ccc.firebasestorage.app",
  messagingSenderId: "60964475196",
  appId: "1:60964475196:web:f6fe2150fae6b0339f4e39",
};

// FCMのWeb Push公開鍵（Phase 3で使用）
export const VAPID_KEY =
  "BLhQHxERjsXw-JGxfSQZuE7WSAEr9QWVYEtzjYSTxpYobQFovi30hJ-5wG_VOJ4RsWX66NT37Sl4QGSohF3XCpg";

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
