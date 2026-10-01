"use client";

// 上部バー：アプリ名（ホームへ）＋右上プロフィールメニュー。PCでは左サイドバーにアプリ名があるため非表示。
import ProfileMenu from "./ProfileMenu";
import Logo from "./Logo";
import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/85 backdrop-blur-md lg:static lg:border-transparent lg:bg-transparent lg:backdrop-blur-none">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2 lg:max-w-none lg:px-8 lg:py-3">
        <div className="lg:hidden">
          <Logo size="sm" />
        </div>
        <span className="hidden lg:block" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <Link href="/guide" className="hidden rounded-full px-3 py-1.5 text-xs font-bold text-ink-2 transition hover:bg-white hover:text-ink lg:inline-block">
            使い方
          </Link>
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
