"use client";

// 登録作品のテレビ放送予定をまとめる独立カレンダーページ。
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getWorks, type Work } from "@/lib/works";
import {
  getTvPrograms,
  getUserChannels,
  getWatchedMap,
  nextBroadcast,
  type TvProgram,
  type WatchedInfo,
} from "@/lib/home";
import ScheduleCalendar, { type AiringEntry } from "@/components/ScheduleCalendar";
import TodayAnime from "@/components/TodayAnime";
import Mascot from "@/components/Mascot";

export default function CalendarPage() {
  const { user, loading } = useAuth();
  const [works, setWorks] = useState<Work[] | null>(null);
  const [watched, setWatched] = useState<Map<number, WatchedInfo>>(new Map());
  const [programs, setPrograms] = useState<TvProgram[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) {
      setWorks(null);
      setReady(false);
      return;
    }

    let alive = true;
    setReady(false);
    Promise.all([
      getWorks(user.uid),
      getWatchedMap(),
      getTvPrograms(),
      getUserChannels(user.uid),
    ])
      .then(([nextWorks, nextWatched, nextPrograms, nextChannels]) => {
        if (!alive) return;
        setWorks(nextWorks);
        setWatched(nextWatched);
        setPrograms(nextPrograms);
        setChannels(nextChannels);
      })
      .catch(() => {
        if (alive) setWorks([]);
      })
      .finally(() => {
        if (alive) setReady(true);
      });

    return () => {
      alive = false;
    };
  }, [user]);

  const entries = useMemo<AiringEntry[]>(() => {
    const out: AiringEntry[] = [];
    for (const work of works ?? []) {
      const info = watched.get(work.id);
      // 視聴できる放送局の実番組を優先し、見つからなければAniList予定を使う。
      const tv =
        nextBroadcast(work.title, programs, channels) ??
        nextBroadcast(work.title, programs);
      const at = tv?.st ?? info?.nextAt ?? null;
      if (at == null) continue;
      out.push({
        id: work.id,
        title: work.title,
        cover: work.cover || info?.cover || "",
        at,
        ep: tv?.count ?? info?.nextEp ?? null,
        station: tv?.ch ?? "",
      });
    }
    return out.sort((a, b) => a.at - b.at);
  }, [channels, programs, watched, works]);

  if (loading) {
    return <main className="mx-auto max-w-4xl px-4 py-10 text-sm text-black/50">読み込み中…</main>;
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl border border-[#ECECF2] bg-white p-6 text-center">
          <Mascot pose="device" h={120} />
          <h1 className="mt-2 text-xl font-extrabold text-[#1C1C2E]">放送カレンダー</h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            ログインすると、通知登録した作品のテレビ放送予定を確認できます。
          </p>
          <Link
            href="/login?next=%2Fcalendar"
            className="mt-4 inline-block rounded-full bg-[#C2772A] px-5 py-2.5 text-sm font-bold text-white"
          >
            ログイン
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-5 lg:px-8">
      <div className="flex items-center gap-3">
        <Mascot pose="device" h={52} />
        <div>
          <h1 className="text-2xl font-extrabold text-[#1C1C2E]">カレンダー</h1>
          <p className="text-xs text-[#6B7280]">マイリストのテレビ放送予定</p>
        </div>
      </div>

      <TodayAnime entries={entries} loading={!ready || works === null} />

      <section className="mt-4 rounded-2xl border border-[#ECECF2] bg-white p-3 sm:p-4">
        <ScheduleCalendar entries={entries} />
      </section>
    </main>
  );
}
