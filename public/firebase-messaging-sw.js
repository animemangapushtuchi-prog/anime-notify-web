/* FCM サービスワーカー：アプリを開いていない/別タブのとき、届いた通知をブラウザ通知として表示する。
   （compat SDKをCDNから読み込む定石。アプリ本体のFirebase v12とは独立） */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBG0jHsv1_JH2sbkwZSHOMDt7zoWPu6_iQ",
  authDomain: "anime-notify-app-86ccc.firebaseapp.com",
  projectId: "anime-notify-app-86ccc",
  storageBucket: "anime-notify-app-86ccc.firebasestorage.app",
  messagingSenderId: "60964475196",
  appId: "1:60964475196:web:f6fe2150fae6b0339f4e39",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "アニメ新着情報";
  const body = (payload.notification && payload.notification.body) || "";
  self.registration.showNotification(title, { body });
});
