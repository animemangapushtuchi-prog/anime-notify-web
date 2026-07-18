"use client";

// 設定。プロフィール＋ブラウザ通知＋通知トグル＋視聴できるテレビ放送＋放送リマインド＋契約配信サービス。
import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { getWorks } from "@/lib/works";
import Mascot from "@/components/Mascot";
import { getTvPrograms, distinctChannels, channelGroup } from "@/lib/home";
import EnablePush from "@/components/EnablePush";

type Settings = { enabled: boolean; ep: boolean; stream: boolean; adapt: boolean };
type Bn = { before30: boolean; dayBefore: boolean };
const SERVICE_KEYS = ["dアニメストア", "ABEMA（プレミアム）", "Netflix", "Prime Video", "U-NEXT"];
const GROUPS: ("地上波" | "BS" | "CS")[] = ["地上波", "BS", "CS"];

function Toggle({
  label,
  note,
  value,
  onChange,
  divider = true,
}: {
  label: string;
  note?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  divider?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 ${divider ? "border-b border-black/5" : ""}`}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#1C1C2E]">{label}</p>
        {note && <p className="mt-0.5 text-[11px] leading-snug text-black/50">{note}</p>}
      </div>
      <button
        type="button"
        aria-pressed={value}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 flex-none rounded-full transition ${value ? "bg-[#C2772A]" : "bg-black/20"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${value ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { user, loading, idLabel, slotCap } = useAuth();
  const [s, setS] = useState<Settings | null>(null);
  const [services, setServices] = useState<Record<string, boolean>>({});
  const [channels, setChannels] = useState<string[]>([]);
  const [allChannels, setAllChannels] = useState<string[]>([]);
  const [bn, setBn] = useState<Bn>({ before30: false, dayBefore: false });
  const [count, setCount] = useState(0);

  useEffect(() => {
    getTvPrograms()
      .then((p) => setAllChannels(distinctChannels(p)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) {
      setS(null);
      return;
    }
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        const st = (snap.data()?.settings ?? {}) as {
          enabled?: boolean;
          kinds?: Record<string, boolean>;
          services?: Record<string, boolean>;
          channels?: unknown;
          broadcastNotify?: { before30?: boolean; dayBefore?: boolean };
        };
        const k = st.kinds ?? {};
        const sv = st.services ?? {};
        setS({ enabled: st.enabled !== false, ep: k.ep !== false, stream: k.stream !== false, adapt: k.adapt !== false });
        const map: Record<string, boolean> = {};
        for (const key of SERVICE_KEYS) map[key] = sv[key] === true;
        setServices(map);
        setChannels(Array.isArray(st.channels) ? (st.channels as string[]) : []);
        setBn({ before30: st.broadcastNotify?.before30 === true, dayBefore: st.broadcastNotify?.dayBefore === true });
      })
      .catch(() => setS({ enabled: true, ep: true, stream: true, adapt: true }));
    getWorks(user.uid)
      .then((w) => setCount(w.length))
      .catch(() => {});
  }, [user]);

  if (loading) {
    return <main className="mx-auto max-w-md px-4 py-10 text-sm text-black/50">読み込み中…</main>;
  }
  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <p className="text-sm text-black/60">ログインすると設定を保存できます。</p>
        <Link href="/login" className="mt-3 inline-block rounded-full bg-[#C2772A] px-4 py-2 text-sm font-bold text-white">
          ログイン
        </Link>
      </main>
    );
  }

  const uid = user.uid;
  const persist = async (
    next: Settings,
    nextServices: Record<string, boolean>,
    nextChannels: string[],
    nextBn: Bn
  ) => {
    try {
      await setDoc(
        doc(db, "users", uid),
        {
          settings: {
            enabled: next.enabled,
            kinds: { ep: next.ep, stream: next.stream, adapt: next.adapt },
            services: nextServices,
            channels: nextChannels,
            broadcastNotify: nextBn,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {}
  };
  const save = (next: Settings) => {
    setS(next);
    persist(next, services, channels, bn);
  };
  const toggleService = (key: string) => {
    const ns = { ...services, [key]: !services[key] };
    setServices(ns);
    if (s) persist(s, ns, channels, bn);
  };
  const toggleChannel = (ch: string) => {
    const nc = channels.includes(ch) ? channels.filter((c) => c !== ch) : [...channels, ch];
    setChannels(nc);
    if (s) persist(s, services, nc, bn);
  };
  const saveBn = (nb: Bn) => {
    setBn(nb);
    if (s) persist(s, services, channels, nb);
  };

  const grouped: Record<string, string[]> = { 地上波: [], BS: [], CS: [] };
  for (const ch of allChannels) grouped[channelGroup(ch)].push(ch);

  return (
    <main className="mx-auto max-w-md px-4 py-6 lg:max-w-xl lg:px-8">
      <div className="flex items-center gap-2">
        <Mascot pose="stand" h={44} />
        <h1 className="text-2xl font-extrabold text-[#1C1C2E]">設定</h1>
      </div>

      {/* プロフィールカード */}
      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#ECECF2] bg-white p-4">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#F6E9D5]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C2772A" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-[#1C1C2E]">{idLabel}</p>
          <p className="text-[11px] text-[#6B7280]">無料プラン・登録 {count}/{slotCap}</p>
        </div>
        <button type="button" title="準備中" className="flex-none rounded-xl border border-[#C2772A] px-3 py-1.5 text-xs font-bold text-[#C2772A]">
          プラン変更
        </button>
      </div>

      {/* ブラウザ通知 */}
      <div className="mt-4 rounded-2xl border border-[#ECECF2] bg-white p-4">
        <h2 className="mb-2 text-xs font-bold text-black/50">📱 ブラウザ通知</h2>
        <EnablePush />
        <p className="mt-2 text-[11px] leading-relaxed text-black/50">
          有効にすると、この端末に新話・配信入りのブラウザ通知が届きます。ログアウトすると、この端末への通知は止まります。
        </p>
      </div>

      {/* 通知トグル */}
      {s && (
        <div className="mt-4 rounded-2xl border border-[#ECECF2] bg-white p-4">
          <h2 className="mb-1 text-xs font-bold text-black/50">🔔 通知</h2>
          <Toggle label="通知を受け取る" note="OFFにするとすべての通知が停止します（サーバー側で尊重）" value={s.enabled} onChange={(v) => save({ ...s, enabled: v })} />
          {s.enabled && (
            <>
              <Toggle label="新話の放送" note="「第◯話が放送されました」「放送開始/終了」" value={s.ep} onChange={(v) => save({ ...s, ep: v })} />
              <Toggle label="配信入り" note="「◯◯で配信が始まりました」" value={s.stream} onChange={(v) => save({ ...s, stream: v })} />
              <Toggle label="発表（アニメ化・続編など）" value={s.adapt} onChange={(v) => save({ ...s, adapt: v })} divider={false} />
            </>
          )}
        </div>
      )}

      {/* 視聴できるテレビ放送＋放送リマインド */}
      <div className="mt-4 rounded-2xl border border-[#ECECF2] bg-white p-4">
        <h2 className="mb-1 text-xs font-bold text-black/50">📺 視聴できるテレビ放送（複数選択可）</h2>
        <p className="mb-2 text-[11px] leading-snug text-black/50">
          選んだ放送局を「次回の放送」に優先表示し、下のリマインド通知にも使います。
        </p>
        {allChannels.length === 0 ? (
          <p className="py-2 text-xs text-black/40">放送局を読み込み中…</p>
        ) : (
          <div className="space-y-3">
            {GROUPS.map((g) =>
              grouped[g].length === 0 ? null : (
                <div key={g}>
                  <p className="text-[11px] font-bold text-[#6B7280]">{g}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {grouped[g].map((ch) => {
                      const on = channels.includes(ch);
                      return (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => toggleChannel(ch)}
                          className={`rounded-full px-3 py-1 text-xs font-bold transition ${on ? "bg-[#C2772A] text-white" : "bg-[#F6E9D5] text-[#C2772A]"}`}
                        >
                          {ch}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        )}
        {channels.length > 0 && <p className="mt-2 text-[11px] text-[#6B7280]">選択中：{channels.length}局</p>}

        <div className="mt-3 border-t border-black/5 pt-1">
          <p className="pt-2 text-[11px] font-bold text-[#6B7280]">⏰ 放送リマインド（登録作品が上の局で放送されるとき）</p>
          <Toggle label="放送30分前に通知" value={bn.before30} onChange={(v) => saveBn({ ...bn, before30: v })} />
          <Toggle label="前日にまとめて通知（前夜）" value={bn.dayBefore} onChange={(v) => saveBn({ ...bn, dayBefore: v })} divider={false} />
          {channels.length === 0 && (
            <p className="mt-1 text-[11px] text-[#DC2626]">※ リマインドには、視聴できる放送局の選択が必要です。</p>
          )}
        </div>
      </div>

      {/* 契約中の配信サービス */}
      <div className="mt-4 rounded-2xl border border-[#ECECF2] bg-white p-4">
        <h2 className="mb-1 text-xs font-bold text-black/50">📡 契約中の配信サービス（優先表示に使います）</h2>
        {SERVICE_KEYS.map((key, i) => (
          <Toggle key={key} label={key} value={services[key] ?? false} onChange={() => toggleService(key)} divider={i !== SERVICE_KEYS.length - 1} />
        ))}
        <p className="mt-2 text-[11px] text-black/50">対応サービスは順次追加予定です。</p>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-black/50">変更は自動で保存されます。</p>
    </main>
  );
}
