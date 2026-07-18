"use client";

// 上部バー：モバイルはアプリ名（ホームへ）、PCは中央に検索バー＋右上プロフィール。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ProfileMenu from "./ProfileMenu";

export default function SiteHeader() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    router.push(v ? `/search?q=${encodeURIComponent(v)}` : "/search");
  };

  return (
    <header className="sticky top-0 z-20 border-b border-[#ECECF2] bg-[#F6F6FA]/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2 lg:max-w-none lg:px-8">
        <Link
          href="/"
          className="text-lg font-extrabold text-[#5B4FCF] lg:hidden"
        >
          アニミル！
        </Link>

        <form onSubmit={submit} className="hidden lg:block lg:max-w-xl lg:flex-1">
          <div className="flex items-center gap-2 rounded-full border border-[#ECECF2] bg-white px-4 py-2 focus-within:border-[#5B4FCF]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6B7280"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="作品・スタジオ・声優で検索"
              className="w-full bg-transparent text-sm text-[#1C1C2E] outline-none placeholder:text-[#9CA3AF]"
            />
          </div>
        </form>

        <ProfileMenu />
      </div>
    </header>
  );
}
