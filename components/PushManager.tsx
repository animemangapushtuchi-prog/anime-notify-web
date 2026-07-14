"use client";

// ログイン中は（許可済みなら）静かにトークンを登録し、前面通知をトーストで表示する。
// layout に一度だけ置く。
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { registerPushToken, subscribeForeground } from "@/lib/fcm";

export default function PushManager() {
  const { user } = useAuth();
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    registerPushToken(user.uid).catch(() => {});

    let cancelled = false;
    let unsub: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    subscribeForeground((title, body) => {
      setToast({ title, body });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 6000);
    }).then((u) => {
      if (cancelled) u();
      else unsub = u;
    });

    return () => {
      cancelled = true;
      if (unsub) unsub();
      if (timer) clearTimeout(timer);
    };
  }, [user]);

  if (!toast) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto max-w-md px-4">
      <div className="rounded-xl bg-[#1C1C2E] px-4 py-3 text-white shadow-lg">
        <p className="text-sm font-bold">{toast.title}</p>
        <p className="mt-0.5 whitespace-pre-line text-xs text-white/80">{toast.body}</p>
      </div>
    </div>
  );
}
