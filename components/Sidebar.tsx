"use client";

// PC(lg以上)専用の左サイドバー。モバイルでは非表示（下タブを使う）。
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const c = active ? "#C2772A" : "#6B7280";
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
  { href: "/osusume", label: "おすすめ", icon: "star" },
  { href: "/notifications", label: "通知", icon: "bell" },
  { href: "/settings", label: "設定", icon: "gear" },
];

export default function Sidebar() {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-[#ECECF2] bg-[#F6F6FA] px-3 py-4 lg:flex">
      <div className="px-3 pb-5">
        <Logo size="md" />
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map((t) => {
          const on = isActive(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold ${
                on
                  ? "bg-[#F6E9D5] text-[#C2772A]"
                  : "text-[#4B5563] hover:bg-black/5"
              }`}
            >
              <NavIcon name={t.icon} active={on} />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
