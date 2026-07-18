"use client";

// 右上プロフィールメニュー（Flutter版のドロップダウン相当）。
import { useState } from "react";
import Link from "next/link";
import { useAuth, logout } from "@/lib/auth";
import { auth } from "@/lib/firebase";

export default function ProfileMenu() {
  const { user, idLabel } = useAuth();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const close = () => setOpen(false);

  async function handleDelete() {
    if (deleting) return;
    if (!window.confirm("退会すると、登録した作品や課金状況などは二度と復元できなくなります。続けますか？")) return;
    if (!window.confirm("本当に退会してよろしいですか？")) return;
    setDeleting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("no-auth");
      const res = await fetch(
        "https://asia-northeast1-anime-notify-app-86ccc.cloudfunctions.net/deleteAccount",
        { method: "POST", headers: { Authorization: `Bearer ${idToken}` } }
      );
      if (!res.ok) throw new Error("failed");
      await logout().catch(() => {});
      window.location.href = "/";
    } catch {
      setDeleting(false);
      window.alert("退会に失敗しました。時間をおいて再度お試しください。");
    }
  }

  const soon = (label: string) => (
    <div className="flex items-center justify-between px-4 py-2 text-sm text-black/40">
      <span>{label}</span>
      <span className="text-[10px]">準備中</span>
    </div>
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="アカウント"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ECECF2] bg-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C1C2E" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} />
          <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-[#ECECF2] bg-white py-1 shadow-xl">
            {user ? (
              <p className="px-4 py-2.5 text-sm font-bold text-[#1C1C2E]">ID: {idLabel}</p>
            ) : (
              <Link href="/login" onClick={close} className="block px-4 py-2.5 text-sm font-bold text-[#5B4FCF]">
                ログイン
              </Link>
            )}
            {soon("プロフィール編集")}
            <Link href="/settings" onClick={close} className="block px-4 py-2 text-sm text-[#1C1C2E]">
              設定
            </Link>
            <Link
              href="/guide"
              onClick={close}
              className="block px-4 py-2 text-sm text-[#1C1C2E]"
            >
              使い方ガイド
            </Link>
            <Link
              href="/survey"
              onClick={close}
              className="block px-4 py-2 text-sm text-[#1C1C2E]"
            >
              アンケートに答える
            </Link>
            {soon("アプリ版への案内")}
            <a
              href="mailto:animemangapushtuchi@gmail.com"
              onClick={close}
              className="block px-4 py-2 text-sm text-[#1C1C2E]"
            >
              お問い合わせ
            </a>
            <div className="my-1 border-t border-[#ECECF2]" />
            <Link href="/terms" onClick={close} className="block px-4 py-2 text-sm text-[#1C1C2E]">
              利用規約
            </Link>
            <Link href="/privacy" onClick={close} className="block px-4 py-2 text-sm text-[#1C1C2E]">
              プライバシーポリシー
            </Link>
            {user && (
              <>
                <div className="my-1 border-t border-[#ECECF2]" />
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    close();
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm font-bold text-[#DC2626]"
                >
                  ログアウト
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="block w-full px-4 py-2.5 text-left text-xs text-black/40 disabled:opacity-50"
                >
                  {deleting ? "退会処理中…" : "退会する"}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
