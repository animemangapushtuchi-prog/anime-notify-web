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
    <div className="rounded-2xl border border-[#ECECF2] bg-white p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <span className="text-[13px] font-bold text-[#6B7280]">{title}</span>
        <span
          className={`text-black/40 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ⌄
        </span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
