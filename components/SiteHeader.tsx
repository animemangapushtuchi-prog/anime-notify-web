"use client";

// 上部バー：アプリ名（ホームへ）＋右上プロフィールメニュー。ナビは下タブに移動。
import Link from "next/link";
import ProfileMenu from "./ProfileMenu";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[#ECECF2] bg-[#F6F6FA]/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2">
        <Link href="/" className="text-lg font-extrabold text-[#5B4FCF]">
          アニミル
        </Link>
        <ProfileMenu />
      </div>
    </header>
  );
}
