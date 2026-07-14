"use client";

// 全ページ共通のヘッダー。認証状態でログイン/ログアウトを出し分ける。
import Link from "next/link";
import { useAuth, logout } from "@/lib/auth";

export default function SiteHeader() {
  const { user, idLabel, loading } = useAuth();
  return (
    <header className="sticky top-0 z-20 border-b border-black/10 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
        <Link href="/" className="text-sm font-extrabold text-[#5B4FCF]">
          アニメ・漫画 新着通知
        </Link>
        <nav className="flex items-center gap-2 text-xs font-bold">
          <Link href="/search" className="px-2 py-1 text-[#5B4FCF]">
            🔍 検索
          </Link>
          {loading ? null : user ? (
            <>
              <Link href="/me" className="px-2 py-1 text-[#5B4FCF]">
                マイリスト
              </Link>
              <Link href="/notifications" className="px-2 py-1 text-[#5B4FCF]">
                🔔 通知
              </Link>
              <Link href="/settings" className="px-2 py-1 text-[#5B4FCF]">
                ⚙
              </Link>
              <span className="hidden text-black/50 sm:inline">ID: {idLabel}</span>
              <button
                type="button"
                onClick={() => logout()}
                className="rounded-full bg-[#ECEAFD] px-3 py-1 text-[#5B4FCF]"
              >
                ログアウト
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-[#5B4FCF] px-3 py-1 text-white"
            >
              ログイン
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
