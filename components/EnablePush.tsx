"use client";

// ブラウザ通知の有効化ボタン。設定ページに置く。許可の状態で表示を出し分ける。
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { requestAndRegisterPush } from "@/lib/fcm";

type Perm = NotificationPermission | "unsupported";

export default function EnablePush() {
  const { user } = useAuth();
  const [perm, setPerm] = useState<Perm>("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined") setPerm("unsupported");
    else setPerm(Notification.permission);
  }, []);

  if (!user) return null;

  const enable = async () => {
    setBusy(true);
    await requestAndRegisterPush(user.uid);
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    setBusy(false);
  };

  if (perm === "unsupported") {
    return (
      <p className="text-xs text-black/50">
        このブラウザはブラウザ通知に対応していません。iPhoneの場合はSafariで「ホーム画面に追加」すると通知が使えます。
      </p>
    );
  }
  if (perm === "granted") {
    return <p className="text-xs font-bold text-emerald-600">✓ ブラウザ通知は有効です</p>;
  }
  if (perm === "denied") {
    return (
      <p className="text-xs text-black/50">
        ブラウザ通知がブロックされています。アドレスバーの🔒アイコンから、このサイトの通知を「許可」に変更してください。
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={enable}
      disabled={busy}
      className="rounded-xl bg-[#5B4FCF] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
    >
      {busy ? "設定中…" : "🔔 ブラウザ通知を有効にする"}
    </button>
  );
}
