"use client";

// 視聴ステータスの切り替え部品。タップでボトムシートを開き、各状態が「何を通知するか」を提示。
// 選択すると、その状態の通知内容を小さなトーストで表示する。一覧・詳細で共用。
import { useRef, useState } from "react";
import { WATCH_STATUSES, type WatchStatus } from "@/lib/works";

// 各状態が受け取る通知の説明（＝ユーザーへの約束。バックエンド差別化の指針でもある）
export const STATUS_NOTE: Record<string, string> = {
  "": "登録中：新着情報が入り次第お知らせします",
  want: "次の放送開始や配信入りのときにお知らせ！",
  watching: "新しい話の放送・配信を、そのつどお知らせ！",
  watched: "続編・劇場化など、大きな情報だけお知らせ",
  paused: "通知はお休み中（大事な情報だけ）",
  dropped: "この作品の通知は送りません",
};

const noteFor = (s: WatchStatus | null) => STATUS_NOTE[s ?? ""] ?? "";
const labelFor = (s: WatchStatus | null) =>
  s ? WATCH_STATUSES.find((x) => x.key === s)?.label ?? "未選択" : "未選択";

export default function StatusPicker({
  current,
  onChange,
  size = "md",
}: {
  current?: WatchStatus;
  onChange: (s: WatchStatus | null) => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cur = WATCH_STATUSES.find((x) => x.key === current);

  function pick(s: WatchStatus | null) {
    onChange(s);
    setOpen(false);
    setToast(`「${labelFor(s)}」${noteFor(s)}`);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2800);
  }

  const triggerCls =
    size === "sm"
      ? "px-3 py-1 text-xs"
      : "px-3.5 py-1.5 text-sm";

  const options: (WatchStatus | null)[] = [
    "want",
    "watching",
    "watched",
    "paused",
    "dropped",
    null,
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="視聴ステータスを変更"
        className={`inline-flex flex-none items-center gap-1 rounded-full font-bold transition ${triggerCls} ${
          cur
            ? ""
            : "border border-dashed border-[#C2772A] bg-[#FBF3E6] text-[#C2772A]"
        }`}
        style={cur ? { color: cur.color, background: cur.bg } : undefined}
      >
        {cur ? cur.label : "＋ 状態を選ぶ"}
        <span className="opacity-60">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white p-4 pb-8 shadow-2xl">
            <div className="mx-auto max-w-md">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E5E5EC]" />
              <p className="text-sm font-extrabold text-[#1C1C2E]">視聴ステータスを選ぶ</p>
              <p className="mt-0.5 text-[11px] text-[#6B7280]">
                状態によって、届く通知の内容が変わります。
              </p>
              <div className="mt-3 space-y-1.5">
                {options.map((s) => {
                  const meta = s ? WATCH_STATUSES.find((x) => x.key === s) : undefined;
                  const on = (current ?? null) === s;
                  return (
                    <button
                      key={s ?? "none"}
                      type="button"
                      onClick={() => pick(s)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        on ? "border-[#C2772A] bg-[#FBF3E6]" : "border-[#ECECF2] bg-white"
                      }`}
                    >
                      <span
                        className="flex-none rounded-full px-2.5 py-1 text-xs font-bold"
                        style={
                          meta
                            ? { color: meta.color, background: meta.bg }
                            : { color: "#6B7280", background: "#F1F1F5" }
                        }
                      >
                        {labelFor(s)}
                      </span>
                      <span className="min-w-0 flex-1 text-[12px] leading-snug text-[#374151]">
                        {noteFor(s)}
                      </span>
                      {on && <span className="flex-none text-sm font-bold text-[#C2772A]">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div className="max-w-[90%] rounded-full bg-[#1C1C2E] px-4 py-2 text-center text-xs font-bold text-white shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </>
  );
}
