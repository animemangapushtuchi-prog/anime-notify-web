"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getWorks, removeWork, type Work } from "@/lib/works";
import Mascot from "@/components/Mascot";

export default function MePage() {
  const { user, loading, idLabel, slotCap } = useAuth();
  const [works, setWorks] = useState<Work[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setWorks(null);
      return;
    }
    getWorks(user.uid)
      .then(setWorks)
      .catch(() => setWorks([]));
  }, [user]);

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-black/50">
        読み込み中…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <p className="text-sm text-black/60">
          ログインすると、登録した作品や通知が使えます。
        </p>
        <Link
          href="/login"
          className="mt-3 inline-block rounded-full bg-[#C2772A] px-4 py-2 text-sm font-bold text-white"
        >
          ログイン
        </Link>
      </main>
    );
  }

  async function unregister(id: number) {
    if (!user) return;
    setBusyId(id);
    try {
      setWorks(await removeWork(user.uid, id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <Mascot pose="stand" h={44} />
          <h1 className="text-2xl font-extrabold text-[#1C1C2E]">マイリスト</h1>
        </div>
        <span className="text-xs font-bold text-black/50">
          {works?.length ?? 0}/{slotCap}
        </span>
      </div>
      <p className="mt-1 text-sm text-black/60">ID: {idLabel}</p>

      {works === null ? (
        <p className="mt-6 text-sm text-black/50">読み込み中…</p>
      ) : works.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[#ECECF2] bg-white p-6 text-sm text-black/50">
          まだ登録がありません。
          <Link href="/" className="ml-1 font-bold text-[#C2772A]">
            作品を探す →
          </Link>
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4">
          {works.map((w) => (
            <li key={w.id}>
              <Link href={`/work/${w.id}`} className="group block">
                <div className="aspect-[2/3] overflow-hidden rounded-xl bg-black/5">
                  {w.cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={w.cover}
                      alt={w.title}
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                    />
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs font-semibold text-[#1C1C2E]">
                  {w.title}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => unregister(w.id)}
                disabled={busyId === w.id}
                className="mt-1 text-[11px] font-bold text-black/40 hover:text-red-600 disabled:opacity-50"
              >
                {busyId === w.id ? "…" : "解除"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
