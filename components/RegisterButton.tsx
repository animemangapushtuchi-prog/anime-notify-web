"use client";

// 作品詳細ページの通知登録導線。ログイン復帰後の自動登録と通知状態の案内を含む。
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import {
  getWorks,
  addWork,
  removeWork,
  setWatchStatus,
  type Work,
  type WatchStatus,
} from "@/lib/works";
import StatusPicker from "@/components/StatusPicker";
import EnablePush from "@/components/EnablePush";

type NoticeSettings = {
  enabled: boolean;
  ep: boolean;
  stream: boolean;
  adapt: boolean;
  before30: boolean;
  dayBefore: boolean;
  services: string[];
};

const DEFAULT_NOTICE: NoticeSettings = {
  enabled: true,
  ep: true,
  stream: true,
  adapt: true,
  before30: false,
  dayBefore: false,
  services: [],
};

export default function RegisterButton({ work }: { work: Work }) {
  const { user, loading, slotCap } = useAuth();
  const [works, setWorks] = useState<Work[] | null>(null);
  const [notice, setNotice] = useState<NoticeSettings | null>(null);
  const [justRegistered, setJustRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const autoTried = useRef(false);

  useEffect(() => {
    if (!user) {
      setWorks(null);
      setNotice(null);
      autoTried.current = false;
      return;
    }
    getWorks(user.uid)
      .then(setWorks)
      .catch(() => setWorks([]));

    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        const settings = (snap.data()?.settings ?? {}) as {
          enabled?: boolean;
          kinds?: Record<string, boolean>;
          services?: Record<string, boolean>;
          broadcastNotify?: { before30?: boolean; dayBefore?: boolean };
        };
        setNotice({
          enabled: settings.enabled !== false,
          ep: settings.kinds?.ep !== false,
          stream: settings.kinds?.stream !== false,
          adapt: settings.kinds?.adapt !== false,
          before30: settings.broadcastNotify?.before30 === true,
          dayBefore: settings.broadcastNotify?.dayBefore === true,
          services: Object.entries(settings.services ?? {})
            .filter(([, on]) => on === true)
            .map(([name]) => name),
        });
      })
      .catch(() => setNotice(DEFAULT_NOTICE));
  }, [user]);

  // ログイン画面から戻った場合は、ユーザーが押した作品をそのまま登録する。
  useEffect(() => {
    if (!user || works === null || autoTried.current || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("register") !== "1") return;

    autoTried.current = true;
    url.searchParams.delete("register");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);

    if (works.some((w) => w.id === work.id)) {
      setJustRegistered(true);
      return;
    }
    if (works.length >= slotCap) return;

    setBusy(true);
    addWork(user.uid, work)
      .then((next) => {
        setWorks(next);
        if (next.some((w) => w.id === work.id)) setJustRegistered(true);
      })
      .finally(() => setBusy(false));
  }, [slotCap, user, work, works]);

  if (loading) return null;

  if (!user) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/work/${work.id}?register=1`)}`}
        className="block w-full rounded-xl bg-[#C2772A] py-3 text-center text-sm font-bold text-white"
      >
        🔔 この作品を通知登録
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
      setJustRegistered(!registered && next.some((w) => w.id === work.id));
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
      {!registered ? (
        <button
          type="button"
          onClick={toggle}
          disabled={busy || full}
          className="w-full rounded-xl bg-[#C2772A] py-3 text-sm font-bold text-white transition disabled:opacity-60"
        >
          {busy
            ? "通知登録中…"
            : full
              ? `登録は${slotCap}件までです`
              : "🔔 この作品を通知登録"}
        </button>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#B9E5D3] bg-white">
          <div className="bg-[#E6F7F1] px-4 py-3">
            <p className="text-sm font-extrabold text-[#047857]">
              {justRegistered ? "✓ 通知登録しました" : "✓ この作品を通知登録中"}
            </p>
            <p className="mt-0.5 text-[11px] text-[#047857]/80">
              現在の設定に合わせて、新着情報をお知らせします。
            </p>
          </div>

          <div className="divide-y divide-[#ECECF2] px-4">
            <NoticeRow
              icon="📺"
              title="テレビ放送"
              enabled={(notice?.enabled ?? true) && (notice?.ep ?? true)}
              detail={broadcastDetail(notice)}
            />
            <NoticeRow
              icon="📡"
              title="ネット配信"
              enabled={(notice?.enabled ?? true) && (notice?.stream ?? true)}
              detail={
                notice?.services.length
                  ? `優先：${notice.services.join("、")}`
                  : "利用サービスは未設定"
              }
            />
            <NoticeRow
              icon="📣"
              title="続編・発表"
              enabled={(notice?.enabled ?? true) && (notice?.adapt ?? true)}
              detail="アニメ化・続編などの発表"
            />
          </div>

          <div className="border-t border-[#ECECF2] bg-[#FAFAFC] px-4 py-3">
            <EnablePush />
            <div className="mt-3 flex items-center justify-between gap-3">
              <Link href="/settings" className="text-xs font-bold text-[#C2772A]">
                通知設定を変更 ›
              </Link>
              <button
                type="button"
                onClick={toggle}
                disabled={busy}
                className="text-[11px] font-semibold text-[#6B7280] underline underline-offset-2 disabled:opacity-60"
              >
                {busy ? "解除中…" : "登録を解除する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {registered && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-[#ECECF2] bg-white px-3 py-2.5">
          <span className="text-[13px] font-bold text-[#1C1C2E]">視聴ステータス</span>
          <StatusPicker current={me?.watchStatus} onChange={changeStatus} size="md" />
        </div>
      )}
    </div>
  );
}

function broadcastDetail(notice: NoticeSettings | null): string {
  if (!notice) return "新話の放送を通知";
  const timings = [
    notice.before30 ? "30分前" : "",
    notice.dayBefore ? "前夜" : "",
  ].filter(Boolean);
  return timings.length ? `リマインド：${timings.join("・")}` : "新話の放送を通知";
}

function NoticeRow({
  icon,
  title,
  enabled,
  detail,
}: {
  icon: string;
  title: string;
  enabled: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="text-lg" aria-hidden="true">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-[#1C1C2E]">{title}</p>
        <p className="truncate text-[11px] text-[#6B7280]">{detail}</p>
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
          enabled ? "bg-[#E6F7F1] text-[#047857]" : "bg-[#F1F1F5] text-[#6B7280]"
        }`}
      >
        {enabled ? "ON" : "OFF"}
      </span>
    </div>
  );
}
