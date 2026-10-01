"use client";

// 折りたたみカード（Vシェブロンで開閉）。声優・スタッフ・関連作品に使う。
import { useState } from "react";

export default function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-3xl border border-line bg-white p-5 lg:p-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between"
      >
        <span className="text-[15px] font-black text-ink">{title}</span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full bg-paper-2 text-ink-2 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
