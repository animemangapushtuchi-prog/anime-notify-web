"use client";

// 上部バー：アプリ名（ホームへ）＋右上プロフィールメニュー。PCでは左サイドバーにアプリ名があるため非表示。
import ProfileMenu from "./ProfileMenu";
import Logo from "./Logo";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[#ECECF2] bg-[#F6F6FA]/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2 lg:max-w-none lg:px-8">
        <div className="lg:hidden">
          <Logo size="sm" />
        </div>
        <span className="hidden lg:block" aria-hidden="true" />
        <ProfileMenu />
      </div>
    </header>
  );
}
