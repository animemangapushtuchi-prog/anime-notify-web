"use client";

// 設定。通知マスターOFF＋種別ごとのON/OFFを users/{uid}.settings に保存。
// サーバー（Cloud Functions）は送信時にこの設定を尊重する（OFFなら送らない）。
import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import EnablePush from "@/components/EnablePush";

type Settings = { enabled: boolean; ep: boolean; stream: boolean; adapt: boolean };

function Toggle({
  label,
  note,
  value,
  onChange,
}: {
  label: string;
  note?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-black/5 py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#1C1C2E]">{label}</p>
        {note && <p className="mt-0.5 text-[11px] leading-snug text-black/50">{note}</p>}
      </div>
      <button
        type="button"
        aria-pressed={value}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 flex-none rounded-full transition ${
          value ? "bg-[#5B4FCF]" : "bg-black/20"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            value ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const [s, setS] = useState<Settings | null>(null);

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
        };
        const k = st.kinds ?? {};
        setS({
          enabled: st.enabled !== false,
          ep: k.ep !== false,
          stream: k.stream !== false,
          adapt: k.adapt !== false,
        });
      })
      .catch(() => setS({ enabled: true, ep: true, stream: true, adapt: true }));
  }, [user]);

  if (loading) {
    return <main className="mx-auto max-w-md px-4 py-10 text-sm text-black/50">読み込み中…</main>;
  }
  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <p className="text-sm text-black/60">ログインすると設定を保存できます。</p>
        <Link
          href="/login"
          className="mt-3 inline-block rounded-full bg-[#5B4FCF] px-4 py-2 text-sm font-bold text-white"
        >
          ログイン
        </Link>
      </main>
    );
  }

  const uid = user.uid;
  const save = async (next: Settings) => {
    setS(next);
    try {
      await setDoc(
        doc(db, "users", uid),
        {
          settings: {
            enabled: next.enabled,
            kinds: { ep: next.ep, stream: next.stream, adapt: next.adapt },
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {}
  };

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-2xl font-extrabold text-[#1C1C2E]">設定</h1>

      <div className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
        <h2 className="mb-2 text-xs font-bold text-black/50">📱 ブラウザ通知</h2>
        <EnablePush />
        <p className="mt-2 text-[11px] leading-relaxed text-black/50">
          有効にすると、この端末に新話・配信入りのブラウザ通知が届きます。ログアウトすると、この端末への通知は止まります。
        </p>
      </div>

      {!s ? (
        <p className="mt-6 text-sm text-black/50">読み込み中…</p>
      ) : (
        <div className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
          <h2 className="mb-1 text-xs font-bold text-black/50">🔔 通知</h2>
          <Toggle
            label="通知を受け取る"
            note="OFFにするとすべての通知が停止します（サーバー側で尊重）"
            value={s.enabled}
            onChange={(v) => save({ ...s, enabled: v })}
          />
          {s.enabled && (
            <>
              <Toggle
                label="新話の放送"
                note="「第◯話が放送されました」「放送開始/終了」"
                value={s.ep}
                onChange={(v) => save({ ...s, ep: v })}
              />
              <Toggle
                label="配信入り"
                note="「◯◯で配信が始まりました」"
                value={s.stream}
                onChange={(v) => save({ ...s, stream: v })}
              />
              <Toggle
                label="発表（アニメ化・続編など）"
                value={s.adapt}
                onChange={(v) => save({ ...s, adapt: v })}
              />
            </>
          )}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-black/50">
        変更は自動で保存されます。通知の配達（ブラウザ通知）の有効化は次のステップで追加します。
      </p>
    </main>
  );
}
