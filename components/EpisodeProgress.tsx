"use client";

// 「何話まで見たか」を一覧・詳細の両方で操作する共通部品。
import { useState } from "react";

export default function EpisodeProgress({
  current = 0,
  nextEpisode,
  totalEpisodes,
  onChange,
  compact = false,
}: {
  current?: number;
  nextEpisode?: number | null;
  totalEpisodes?: number | null;
  onChange: (episode: number) => void | Promise<void>;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const watched = Math.max(0, Math.floor(current));
  const total = totalEpisodes && totalEpisodes > 0 ? Math.floor(totalEpisodes) : null;
  const canAdvance = total == null || watched < total;
  const nextToWatch = watched + 1;
  const availableLatest =
    nextEpisode && nextEpisode > 1 ? Math.max(0, nextEpisode - 1) : null;

  const change = async (value: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await onChange(Math.max(0, total ? Math.min(value, total) : value));
    } finally {
      setBusy(false);
    }
  };

  const note =
    watched === 0
      ? "まだ視聴記録はありません"
      : availableLatest != null && watched < availableLatest
        ? `未視聴：第${watched + 1}話〜第${availableLatest}話`
        : canAdvance
          ? `次は第${nextToWatch}話`
          : "全話視聴済み";

  return (
    <div
      className={`rounded-xl border border-[#ECECF2] bg-[#FAFAFC] ${
        compact ? "mt-2 px-2.5 py-2" : "mt-3 px-3 py-3"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className={`${compact ? "text-[11px]" : "text-[13px]"} font-extrabold text-[#1C1C2E]`}>
            {watched > 0 ? `第${watched}話まで視聴` : "視聴進捗"}
            {total ? <span className="ml-1 font-medium text-[#6B7280]">/ 全{total}話</span> : null}
          </p>
          <p className="truncate text-[10px] text-[#6B7280]">{note}</p>
        </div>
        <button
          type="button"
          onClick={() => change(watched - 1)}
          disabled={busy || watched === 0}
          aria-label="視聴済み話数を1話戻す"
          className="h-8 rounded-full border border-[#ECECF2] bg-white px-3 text-xs font-bold text-[#6B7280] disabled:opacity-35"
        >
          −1話
        </button>
        <button
          type="button"
          onClick={() => change(watched + 1)}
          disabled={busy || !canAdvance}
          className="h-8 rounded-full bg-[#C2772A] px-3 text-[11px] font-bold text-white disabled:opacity-40"
        >
          {busy ? "保存中…" : canAdvance ? `第${nextToWatch}話を見た` : "全話視聴済み"}
        </button>
      </div>
    </div>
  );
}
