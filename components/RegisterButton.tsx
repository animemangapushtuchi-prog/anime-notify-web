"use client";

// 作品詳細ページの登録/解除ボタン＋視聴ステータス選択（StatusPicker共用）。
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getWorks,
  addWork,
  removeWork,
  setWatchStatus,
  type Work,
  type WatchStatus,
} from "@/lib/works";
import StatusPicker from "@/components/StatusPicker";

export default function RegisterButton({ work }: { work: Work }) {
  const { user, loading, slotCap } = useAuth();
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
  const full = !registered && works.length >= slotCap;

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
              ? `登録は${slotCap}件までです`
              : "＋ 登録して新着通知を受け取る"}
      </button>

      {registered && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-[#ECECF2] bg-white px-3 py-2.5">
          <span className="text-[13px] font-bold text-[#1C1C2E]">視聴ステータス</span>
          <StatusPicker current={me?.watchStatus} onChange={changeStatus} size="md" />
        </div>
      )}
    </div>
  );
}
