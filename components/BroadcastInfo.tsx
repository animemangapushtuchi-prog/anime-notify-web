"use client";

// テレビ放送（地上波・BS・CS）だけを局ごとにまとめて表示。しょぼいカレンダー由来。
// ネット同時配信のチャンネルは lib/home.ts の共通分類で除外される。
import { useEffect, useState } from "react";
import { getTvPrograms, broadcastSlots, type BroadcastSlot } from "@/lib/home";

const WD = ["日", "月", "火", "水", "木", "金", "土"];
const fmtDate = (at: number) => {
  const d = new Date((at + 9 * 3600) * 1000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};

export default function BroadcastInfo({ title }: { title: string }) {
  const [slots, setSlots] = useState<BroadcastSlot[] | null>(null);

  useEffect(() => {
    let alive = true;
    getTvPrograms()
      .then((p) => alive && setSlots(broadcastSlots(title, p)))
      .catch(() => alive && setSlots([]));
    return () => {
      alive = false;
    };
  }, [title]);

  if (slots === null) return <p className="mt-2 text-xs text-[#625B6E]">確認中…</p>;
  if (slots.length === 0)
    return (
      <p className="mt-2 text-xs text-[#625B6E]">
        テレビ放送の情報は見つかりませんでした（配信のみ、または放送前の可能性があります）。
      </p>
    );

  // 局ごとにまとめる
  const byCh = new Map<string, BroadcastSlot[]>();
  for (const s of slots) {
    const a = byCh.get(s.ch) ?? [];
    a.push(s);
    byCh.set(s.ch, a);
  }

  return (
    <ul className="mt-1 divide-y divide-[#F2ECE3]">
      {[...byCh.entries()].map(([ch, list]) => (
        <li key={ch} className="py-2">
          <p className="text-sm font-bold text-[#1A1523]">{ch}</p>
          <div className="mt-0.5 space-y-0.5">
            {list.map((s, i) => (
              <p key={i} className="text-[12px] text-[#3A3342]">
                {i === 0 ? "" : "リピート："}
                毎週{WD[s.weekday]}曜 {s.hhmm}〜
                {s.nextAt ? <span className="ml-1 text-[#625B6E]">（次 {fmtDate(s.nextAt)}）</span> : null}
              </p>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
