"use client";

// PC(lg以上)専用の左サイドバー。モバイルでは非表示（下タブを使う）。
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import Mascot from "./Mascot";

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const c = active ? "#A8621F" : "#625B6E";
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: c,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "home")
    return (
      <svg {...common}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    );
  if (name === "calendar")
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </svg>
    );
  if (name === "search")
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    );
  if (name === "star")
    return (
      <svg {...common}>
        <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.9 6.8 20.6l1-5.8-4.3-4.1 5.9-.9L12 3.5z" />
      </svg>
    );
  if (name === "stream")
    return (
      <svg {...common}>
        <rect x="2" y="4" width="20" height="14" rx="2" />
        <path d="M10 9l5 3-5 3z" />
        <path d="M8 21h8" />
      </svg>
    );
  if (name === "gear")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

const NAV = [
  { href: "/", label: "マイリスト", icon: "home" },
  { href: "/calendar", label: "カレンダー", icon: "calendar" },
  { href: "/search", label: "検索", icon: "search" },
  { href: "/streaming", label: "今期配信", icon: "stream" },
  { href: "/osusume", label: "おすすめ", icon: "star" },
  { href: "/notifications", label: "通知", icon: "bell" },
  { href: "/settings", label: "設定", icon: "gear" },
];

export default function Sidebar() {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-paper px-4 py-5 lg:flex">
      <div className="px-2 pb-7">
        <Logo size="md" />
      </div>
      <nav className="flex flex-col gap-0.5" aria-label="メインメニュー">
        {NAV.map((t) => {
          const on = isActive(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-bold transition ${
                on
                  ? "bg-white text-ink shadow-[0_1px_2px_rgba(26,21,35,0.06),0_8px_20px_-14px_rgba(26,21,35,0.35)] ring-1 ring-line"
                  : "text-ink-2 hover:bg-white/70 hover:text-ink"
              }`}
            >
              {on && <span aria-hidden="true" className="absolute -left-4 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-amber" />}
              <NavIcon name={t.icon} active={on} />
              {t.label}
            </Link>
          );
        })}
      </nav>
      {/* 下：使い方への入口。夜更かしの見張り番 */}
      <Link href="/guide" className="group mt-auto flex items-end gap-2 rounded-2xl border border-line bg-white/70 p-3 transition hover:border-amber">
        <Mascot pose="sit" h={54} />
        <span className="pb-1 text-[12px] leading-snug text-ink-2">
          <span className="block font-bold text-ink group-hover:text-amber-ink">使い方ガイド</span>
          はじめての方へ
        </span>
      </Link>
    </aside>
  );
}
