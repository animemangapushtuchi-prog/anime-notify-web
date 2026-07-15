"use client";

// 作品詳細ページの登録/解除ボタン＋視聴ステータス選択。未ログインならログイン誘導。枠は10件まで。
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getWorks,
  addWork,
  removeWork,
  setWatchStatus,
  MAX_SLOTS,
  WATCH_STATUSES,
  type Work,
  type WatchStatus,
} from "@/lib/works";

export default function RegisterButton({ work }: { work: Work }) {
  const { user, loading } = useAuth();
  const [works, setWorks] = useState<Work[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      setWorks(null);
      return;
    }
    getWorks(user.uid)
      .then(setWorks)
      .catch(() => setWorks([]));
  }, [user]);

  if (loading) return null;

  if (!user) {
    return (
      <Link
        href="/login"
        className="block w-full rounded-xl bg-[#5B4FCF] py-3 text-center text-sm font-bold text-white"
      >
        ログインすると登録・通知が使えます
      </Link>
    );
  }

  if (works === null) {
    return (
      <div className="w-full rounded-xl border border-[#ECECF2] py-3 text-center text-sm text-black/40">
        …
      </div>
    );
  }

  const me = works.find((w) => w.id === work.id);
  const registered = !!me;
  const full = !registered && works.length >= MAX_SLOTS;

  async function toggle() {
    if (!user || busy || full) return;
    setBusy(true);
    try {
      const next = registered
        ? await removeWork(user.uid, work.id)
        : await addWork(user.uid, work);
      setWorks(next);
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(s: WatchStatus | null) {
    if (!user) return;
    setWorks((prev) =>
      prev ? prev.map((w) => (w.id === work.id ? { ...w, watchStatus: s ?? undefined } : w)) : prev
    );
    try {
      await setWatchStatus(user.uid, work.id, s);
    } catch {}
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy || full}
        className={`w-full rounded-xl py-3 text-sm font-bold transition disabled:opacity-60 ${
          registered
            ? "border border-[#5B4FCF] bg-white text-[#5B4FCF]"
            : "bg-[#5B4FCF] text-white"
        }`}
      >
        {busy
          ? "処理中…"
          : registered
            ? "✓ 登録済み（タップで解除）"
            : full
              ? `登録は${MAX_SLOTS}件までです`
              : "＋ 登録して新着通知を受け取る"}
      </button>

      {registered && (
        <div className="mt-2">
          <p className="text-[11px] font-bold text-[#6B7280]">視聴ステータス</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => changeStatus(null)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                !me?.watchStatus
                  ? "bg-[#1C1C2E] text-white"
                  : "border border-[#ECECF2] bg-white text-[#6B7280]"
              }`}
            >
              未選択
            </button>
            {WATCH_STATUSES.map((s) => {
              const on = me?.watchStatus === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => changeStatus(s.key)}
                  className="rounded-full px-3 py-1 text-xs font-bold transition"
                  style={
                    on
                      ? { color: "#fff", background: s.color }
                      : { color: s.color, background: s.bg }
                  }
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
