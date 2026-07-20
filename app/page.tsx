"use client";

// ホーム＝マイリスト。放送予定は独立したカレンダーページで表示する。
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getWorks,
  removeWork,
  setWatchedEpisode,
  setWatchStatus,
  WATCH_STATUSES,
  type Work,
  type WatchStatus,
} from "@/lib/works";
import {
  getWatchedMap,
  getTvPrograms,
  nextBroadcast,
  type WatchedInfo,
  type TvProgram,
} from "@/lib/home";
import { svcRank } from "@/lib/anilist";
import { getUserPrefs, isSubscribedService, sortSubscribedFirst } from "@/lib/subscriptions";
import ServiceIcon from "@/components/ServiceIcon";
import SurveyCard from "@/components/SurveyCard";
import StatusPicker from "@/components/StatusPicker";
import EpisodeProgress from "@/components/EpisodeProgress";
import AdSlot from "@/components/AdSlot";
import Mascot from "@/components/Mascot";

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
type Filter = WatchStatus | "all";

export default function Home() {
  const { user, loading, slotCap, loginBonusToday } = useAuth();
  const [works, setWorks] = useState<Work[] | null>(null);
  const [watched, setWatched] = useState<Map<number, WatchedInfo>>(new Map());
  const [progs, setProgs] = useState<TvProgram[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  // 契約中の配信サービス（設定でONにしたキー。未設定・未ログイン・取得失敗時は空＝従来表示）
  const [subKeys, setSubKeys] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("air");
  const [filter, setFilter] = useState<Filter>("all");
  const [svc, setSvc] = useState<string>("all");
  const [edit, setEdit] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setWorks(null);
      return;
    }
    getWorks(user.uid).then(setWorks).catch(() => setWorks([]));
    Promise.all([
      getWatchedMap().then(setWatched).catch(() => setWatched(new Map())),
      getTvPrograms().then(setProgs).catch(() => setProgs([])),
      // users/{uid} は1回だけ読み、放送局と契約中サービスを同時に取得する
      getUserPrefs(user.uid)
        .then((p) => {
          setChannels(p.channels);
          setSubKeys(p.services);
        })
        .catch(() => {
          setChannels([]);
          setSubKeys([]);
        }),
    ]);
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

  const shown = useMemo(
    () =>
      sorted.filter((w) => {
        if (filter !== "all" && w.watchStatus !== filter) return false;
        const services = watched.get(w.id)?.services ?? [];
        if (svc === "all") return true;
        if (svc === "_sub") {
          // 契約中サービス未設定なら絞り込まない（作品が消えないように）
          if (subKeys.length === 0) return true;
          return services.some((s) => isSubscribedService(s, subKeys));
        }
        return services.includes(svc);
      }),
    [sorted, filter, svc, watched, subKeys]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const w of works ?? []) if (w.watchStatus) c[w.watchStatus] = (c[w.watchStatus] ?? 0) + 1;
    return c;
  }, [works]);

  // 登録作品が実際に持つ配信サービスだけを動的に列挙（主要サービス順）
  const svcList = useMemo(() => {
    const set = new Set<string>();
    for (const w of works ?? [])
      for (const s of watched.get(w.id)?.services ?? []) set.add(s);
    return [...set].sort((a, b) => svcRank(a, "") - svcRank(b, ""));
  }, [works, watched]);

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-lg font-extrabold text-[#C2772A]">アニミル！</h1>
        <p className="mt-1 text-sm text-black/60">
          アニメの放送・配信入りを自動で新着通知。登録した作品の新話・配信入りをお知らせします。
        </p>
        <p className="mt-4 text-sm text-black/40">読み込み中…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl border border-[#ECECF2] bg-white p-6">
          <div className="mb-3 flex justify-center">
            <Mascot pose="wave" h={140} />
          </div>
          <p className="text-lg font-extrabold text-[#1C1C2E]">
            ようこそ！3ステップで始まります
          </p>
          <ol className="mt-3 space-y-2 text-sm text-black/70">
            <li>① メールアドレスで無料登録</li>
            <li>② 「検索」タブから好きな作品を登録</li>
            <li>③ 新話の放送・配信入りを自動で通知</li>
          </ol>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-full bg-[#C2772A] px-5 py-2.5 text-sm font-bold text-white"
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

  const changeStatus = async (id: number, s: WatchStatus | null) => {
    if (!user) return;
    setWorks((prev) =>
      prev ? prev.map((w) => (w.id === id ? { ...w, watchStatus: s ?? undefined } : w)) : prev
    );
    try {
      await setWatchStatus(user.uid, id, s);
    } catch {}
  };

  const changeEpisode = async (id: number, episode: number) => {
    if (!user) return;
    setWorks((prev) =>
      prev
        ? prev.map((w) =>
            w.id === id ? { ...w, watchedEpisode: episode || undefined } : w
          )
        : prev
    );
    try {
      await setWatchedEpisode(user.uid, id, episode);
    } catch {
      // 画面上の操作感を優先し、次回の再読み込み時に保存結果と同期する
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-5 lg:max-w-6xl lg:px-8">
      {loginBonusToday && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-[#F6E9D5] px-4 py-2 text-xs font-bold text-[#C2772A]">
          <Mascot pose="cheer" h={40} />
          ログインボーナス！ 登録枠が {slotCap} 枠になりました
        </div>
      )}
      <SurveyCard />

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mascot pose="stand" h={40} />
          <div>
            <h1 className="text-xl font-extrabold text-[#1C1C2E]">マイリスト</h1>
            <p className="text-[10px] text-[#6B7280]">通知登録した作品</p>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            (works?.length ?? 0) >= slotCap
              ? "bg-[#FDEAEA] text-[#DC2626]"
              : "bg-[#F6E9D5] text-[#C2772A]"
          }`}
        >
          {works?.length ?? 0}/{slotCap}
        </span>
      </div>

      <div className="mt-4">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`flex-none rounded-full px-3 py-1 text-xs font-bold transition ${
                filter === "all" ? "bg-[#C2772A] text-white" : "bg-white text-[#6B7280] border border-[#ECECF2]"
              }`}
            >
              すべて {works?.length ?? 0}
            </button>
            {WATCH_STATUSES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setFilter(s.key)}
                className={`flex-none rounded-full px-3 py-1 text-xs font-bold transition ${
                  filter === s.key ? "bg-[#C2772A] text-white" : "bg-white text-[#6B7280] border border-[#ECECF2]"
                }`}
              >
                {s.label} {counts[s.key] ?? 0}
              </button>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-end gap-3 text-xs font-bold">
            {svcList.length > 0 && (
              <select
                value={svc}
                onChange={(e) => setSvc(e.target.value)}
                className="rounded-full border border-[#ECECF2] bg-white px-2 py-1 text-[#1C1C2E]"
              >
                <option value="all">全サービス</option>
                <option value="_sub" disabled={subKeys.length === 0}>
                  {subKeys.length === 0 ? "契約中のみ（未設定）" : "契約中のみ"}
                </option>
                {svcList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-full border border-[#ECECF2] bg-white px-2 py-1 text-[#1C1C2E]"
            >
              <option value="air">放送が近い順</option>
              <option value="added">登録が新しい順</option>
            </select>
            <button type="button" onClick={() => setEdit((v) => !v)} className="text-[#C2772A]">
              {edit ? "完了" : "編集"}
            </button>
          </div>

          {/* 契約中サービス未設定のときは設定画面への短い導線を出す */}
          {subKeys.length === 0 && svcList.length > 0 && (
            <p className="mt-1 text-right text-[11px] text-[#6B7280]">
              <Link href="/settings" className="font-bold text-[#C2772A] underline-offset-2 hover:underline">
                設定
              </Link>
              で契約中の配信サービスを選ぶと優先表示できます
            </p>
          )}

          {works === null ? (
            <p className="mt-6 text-sm text-black/50">読み込み中…</p>
          ) : works.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-[#ECECF2] bg-white p-6 text-center text-sm text-black/50">
              <Mascot pose="point" h={120} />
              <p>まだ登録がありません。「検索」タブから作品を登録すると、新話・配信入りが通知されます。</p>
            </div>
          ) : shown.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-[#ECECF2] bg-white p-6 text-sm text-black/50">
              該当する作品はありません。
            </div>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {shown.map((w) => {
                const info = watched.get(w.id);
                const tv =
                  nextBroadcast(w.title, progs, channels) ??
                  nextBroadcast(w.title, progs);
                const next = fmtNext(
                  tv?.count ?? info?.nextEp ?? null,
                  tv?.st ?? info?.nextAt ?? null,
                  tv?.ch ?? ""
                );
                const cover = w.cover || info?.cover || "";
                const airing = w.status === "RELEASING";
                return (
                  <li key={w.id} className="rounded-2xl border border-[#ECECF2] bg-white p-3">
                    <div className="flex items-center gap-3">
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
                            <div className="mt-1 flex gap-1.5">
                              {/* 契約中サービスを先頭に並べ、✓マーク（色に依存しない印）を付ける */}
                              {sortSubscribedFirst(info.services, (s) => s, subKeys).map((s) =>
                                subKeys.length > 0 && isSubscribedService(s, subKeys) ? (
                                  <span key={s} className="relative inline-flex" title={`${s}（契約中）`}>
                                    <ServiceIcon name={s} size={18} />
                                    <span
                                      aria-label="契約中"
                                      className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-white text-[8px] font-black leading-none text-[#C2772A] ring-1 ring-[#C2772A]"
                                    >
                                      ✓
                                    </span>
                                  </span>
                                ) : (
                                  <ServiceIcon key={s} name={s} size={18} />
                                )
                              )}
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
                        <StatusPicker
                          current={w.watchStatus}
                          onChange={(s) => changeStatus(w.id, s)}
                          size="sm"
                        />
                      )}
                    </div>
                    {!edit && (
                      <EpisodeProgress
                        current={w.watchedEpisode}
                        nextEpisode={tv?.count ?? info?.nextEp ?? null}
                        totalEpisodes={w.episodes ?? info?.episodes ?? null}
                        onChange={(episode) => changeEpisode(w.id, episode)}
                        compact
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
      </div>

      <AdSlot className="mt-8" />
    </main>
  );
}
