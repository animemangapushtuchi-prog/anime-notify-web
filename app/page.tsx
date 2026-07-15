"use client";

// ホーム＝自分の登録作品リスト（次の予定・放送局・配信アイコン・ソート・編集）。
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getWorks, removeWork, MAX_SLOTS, type Work } from "@/lib/works";
import {
  getWatchedMap,
  getTvPrograms,
  matchStation,
  type WatchedInfo,
  type TvProgram,
} from "@/lib/home";
import ServiceIcon from "@/components/ServiceIcon";
import SurveyCard from "@/components/SurveyCard";

const WD = ["日", "月", "火", "水", "木", "金", "土"];
function fmtNext(nextEp: number | null, nextAt: number | null, station: string): string | null {
  if (nextAt == null) return null;
  const d = new Date((nextAt + 9 * 3600) * 1000);
  const two = (n: number) => String(n).padStart(2, "0");
  const ep = nextEp != null ? `第${nextEp}話　` : "";
  const st = station ? `（${station}）` : "";
  return `次の予定：${ep}${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WD[d.getUTCDay()]}）${two(d.getUTCHours())}:${two(d.getUTCMinutes())}${st}`;
}

type Sort = "air" | "added";

export default function Home() {
  const { user, loading } = useAuth();
  const [works, setWorks] = useState<Work[] | null>(null);
  const [watched, setWatched] = useState<Map<number, WatchedInfo>>(new Map());
  const [progs, setProgs] = useState<TvProgram[]>([]);
  const [sort, setSort] = useState<Sort>("air");
  const [edit, setEdit] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setWorks(null);
      return;
    }
    getWorks(user.uid).then(setWorks).catch(() => setWorks([]));
    getWatchedMap().then(setWatched).catch(() => {});
    getTvPrograms().then(setProgs).catch(() => {});
  }, [user]);

  const sorted = useMemo(() => {
    const list = [...(works ?? [])];
    if (sort === "air") {
      list.sort((a, b) => {
        const aw = watched.get(a.id)?.nextAt ?? Infinity;
        const bw = watched.get(b.id)?.nextAt ?? Infinity;
        return aw - bw;
      });
    } else {
      list.sort((a, b) => (b.added ?? 0) - (a.added ?? 0));
    }
    return list;
  }, [works, watched, sort]);

  if (loading) {
    return <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-black/50">読み込み中…</main>;
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl border border-[#ECECF2] bg-white p-6">
          <p className="text-lg font-extrabold text-[#1C1C2E]">
            👋 ようこそ！3ステップで始まります
          </p>
          <ol className="mt-3 space-y-2 text-sm text-black/70">
            <li>① ログイン（ID＋パスワードだけ）</li>
            <li>② 「検索」タブから好きな作品を登録</li>
            <li>③ 新話の放送・配信入りを自動で通知</li>
          </ol>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-full bg-[#5B4FCF] px-5 py-2.5 text-sm font-bold text-white"
          >
            はじめる（ログイン / 新規登録）
          </Link>
        </div>
        <p className="mt-4 text-xs text-black/50">
          下の「検索」タブから、ログインなしで作品やPV・配信情報を見ることもできます。
        </p>
      </main>
    );
  }

  const unregister = async (id: number) => {
    if (!user) return;
    setBusyId(id);
    try {
      setWorks(await removeWork(user.uid, id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-5">
      <SurveyCard />
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-xl font-extrabold text-[#1C1C2E]">
          <span className="text-[#F5C518]">★</span> 登録作品
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              (works?.length ?? 0) >= MAX_SLOTS
                ? "bg-[#FDEAEA] text-[#DC2626]"
                : "bg-[#ECEAFD] text-[#5B4FCF]"
            }`}
          >
            {works?.length ?? 0}/{MAX_SLOTS}
          </span>
        </h1>
        <div className="flex items-center gap-3 text-xs font-bold">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-full border border-[#ECECF2] bg-white px-2 py-1 text-[#1C1C2E]"
          >
            <option value="air">放送が近い順</option>
            <option value="added">登録が新しい順</option>
          </select>
          <button type="button" onClick={() => setEdit((v) => !v)} className="text-[#5B4FCF]">
            {edit ? "完了" : "編集"}
          </button>
        </div>
      </div>

      {works === null ? (
        <p className="mt-6 text-sm text-black/50">読み込み中…</p>
      ) : works.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[#ECECF2] bg-white p-6 text-sm text-black/50">
          まだ登録がありません。下の「検索」タブから作品を登録すると、新話・配信入りが通知されます。
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[#ECECF2] overflow-hidden rounded-2xl border border-[#ECECF2] bg-white">
          {sorted.map((w) => {
            const info = watched.get(w.id);
            const station = matchStation(w.title, progs)?.ch ?? "";
            const next = fmtNext(info?.nextEp ?? null, info?.nextAt ?? null, station);
            const cover = w.cover || info?.cover || "";
            const airing = w.status === "RELEASING";
            return (
              <li key={w.id} className="flex items-center gap-3 px-3 py-3">
                <Link href={`/work/${w.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  {cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt={w.title} className="h-16 w-11 flex-none rounded-md object-cover" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-[#1C1C2E]">{w.title}</span>
                      <span
                        className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          airing ? "bg-[#FDEAEA] text-[#DC2626]" : "bg-black/5 text-black/50"
                        }`}
                      >
                        {airing ? "放送中" : "放送終了"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-[#6B7280]">{next ?? w.meta}</p>
                    {info && info.services.length > 0 && (
                      <div className="mt-1 flex gap-1">
                        {info.services.map((s) => (
                          <ServiceIcon key={s} name={s} size={18} />
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
                {edit ? (
                  <button
                    type="button"
                    onClick={() => unregister(w.id)}
                    disabled={busyId === w.id}
                    className="flex-none rounded-full bg-[#FDEAEA] px-3 py-1 text-[11px] font-bold text-[#DC2626]"
                  >
                    {busyId === w.id ? "…" : "解除"}
                  </button>
                ) : (
                  <span className="flex-none text-black/30">›</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
