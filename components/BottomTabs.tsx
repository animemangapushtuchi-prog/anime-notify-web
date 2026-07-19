"use client";

// モバイル用の下タブ。マイリストとカレンダーを独立した項目として表示する。
import Link from "next/link";
import { usePathname } from "next/navigation";

function Icon({ name, active }: { name: string; active: boolean }) {
  const c = active ? "#C2772A" : "#6B7280";
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
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
  return (
    <svg {...common}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

const TABS = [
  { href: "/", label: "マイリスト", icon: "home" },
  { href: "/calendar", label: "カレンダー", icon: "calendar" },
  { href: "/search", label: "検索", icon: "search" },
  { href: "/osusume", label: "おすすめ", icon: "star" },
  { href: "/notifications", label: "通知", icon: "bell" },
];

export default function BottomTabs() {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#ECECF2] bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map((t) => {
          const on = isActive(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-1.5"
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full ${
                  on ? "bg-[#F6E9D5]" : ""
                }`}
              >
                <Icon name={t.icon} active={on} />
              </span>
              <span
                className={`text-[11px] ${
                  on ? "font-bold text-[#C2772A]" : "text-[#6B7280]"
                }`}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
