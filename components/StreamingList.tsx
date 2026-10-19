"use client";

// 今期配信一覧の表示＋絞り込み（クライアント）。データはサーバー側で取得済みのものを受け取る。
// candidate/rejected/不明は渡さない前提（公開エントリーのみ）。
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getUserPrefs, isSubscribedService } from "@/lib/subscriptions";
import { STREAM_SERVICES } from "@/lib/streaming";
import {
  type PublicEntry,
  weeklyLabel,
} from "@/lib/seasonStreaming";
import ServiceIcon from "@/components/ServiceIcon";
import Mascot from "@/components/Mascot";

type Work = {
  anilistId: number;
  title: string;
  coverImage: string;
  services: PublicEntry[]; // その作品の全サービス（並び順はサービス一覧の順で固定）
  matched?: Set<string>; // 絞り込み条件に合ったサービス
  earliest: number | null; // 最も早い初回配信(UNIX秒)
  days: Set<number>;
};

function groupByWork(entries: PublicEntry[]): Work[] {
  const map = new Map<number, Work>();
  for (const e of entries) {
    let w = map.get(e.anilistId);
    if (!w) {
      w = {
        anilistId: e.anilistId,
        title: e.title,
        coverImage: e.coverImage,
        services: [],
        earliest: null,
        days: new Set(),
      };
      map.set(e.anilistId, w);
    }
    w.services.push(e);
    if (!w.coverImage && e.coverImage) w.coverImage = e.coverImage;
    if (e.firstAvailableAt != null)
      w.earliest = w.earliest == null ? e.firstAvailableAt : Math.min(w.earliest, e.firstAvailableAt);
    if (e.weeklyDay != null) w.days.add(e.weeklyDay);
  }
  // どの作品でも同じ位置に同じサービスが来るよう、サービス一覧の順に並べる
  const order = new Map(STREAM_SERVICES.map((s, i) => [s.key, i]));
  for (const w of map.values()) w.services.sort((a, b) => (order.get(a.serviceKey) ?? 99) - (order.get(b.serviceKey) ?? 99));
  return [...map.values()];
}

// カードに1行で出す「いつから・いつ見られるか」：最速の配信（無ければ開始日が最も早い配信）を代表にする
function headline(w: Work): { date: string | null; weekly: string | null; fastest: string[] } {
  const fastest = w.services.filter((e) => e.isFastest);
  const pool = fastest.length ? fastest : w.services;
  const rep =
    [...pool].sort((a, b) => (a.firstAvailableAt ?? Infinity) - (b.firstAvailableAt ?? Infinity))[0] ?? null;
  const withWeekly = pool.find((e) => e.weeklyDay != null) ?? null;
  return {
    date: w.earliest != null ? mdLabel(w.earliest) : rep?.firstAvailableAt != null ? mdLabel(rep.firstAvailableAt) : null,
    weekly: withWeekly ? weeklyLabel(withWeekly.weeklyDay, withWeekly.weeklyTime) : null,
    fastest: fastest.map((e) => e.serviceName),
  };
}

const WD = ["日", "月", "火", "水", "木", "金", "土"];

// 「10/2」形式（JST）
function mdLabel(sec: number): string {
  const d = new Date((sec + 9 * 3600) * 1000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export default function StreamingList({
  entries,
  lockedServiceKey,
}: {
  entries: PublicEntry[];
  lockedServiceKey?: string;
}) {
  const { user } = useAuth();
  const [subKeys, setSubKeys] = useState<string[]>([]); // 契約中サービスの設定キー
  const [svc, setSvc] = useState<Set<string>>(new Set());
  const [day, setDay] = useState<number | "all">("all");
  const [onlySub, setOnlySub] = useState(false);
  const [onlyIncluded, setOnlyIncluded] = useState(false);
  const [onlyFree, setOnlyFree] = useState(false);
  const [onlyExclusive, setOnlyExclusive] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"day" | "date" | "title">("day");

  useEffect(() => {
    if (!user) {
      setSubKeys([]);
      return;
    }
    getUserPrefs(user.uid).then((p) => setSubKeys(p.services)).catch(() => {});
  }, [user]);

  // サービス一覧（このデータに存在するものだけをチップに）
  // サービスごとの作品数を添えて、多い順に並べる（どのサービスで何本見られるかがボタンで分かるように）
  const presentServices = useMemo(() => {
    const count = new Map<string, Set<number>>();
    for (const e of entries) {
      if (!count.has(e.serviceKey)) count.set(e.serviceKey, new Set());
      count.get(e.serviceKey)!.add(e.anilistId);
    }
    return STREAM_SERVICES.filter((s) => count.has(s.key))
      .map((s) => ({ ...s, works: count.get(s.key)!.size }))
      .sort((a, b) => b.works - a.works);
  }, [entries]);

  const works = useMemo(() => groupByWork(entries), [entries]);

  const shown = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const list = works
      .map((w) => {
        // 絞り込み条件に合うサービスを数える（カードには全サービスを出し、合うものを強調する）
        const svcs = w.services.filter((e) => {
          if (lockedServiceKey && e.serviceKey !== lockedServiceKey) return false;
          if (svc.size > 0 && !svc.has(e.serviceKey)) return false;
          if (onlyIncluded && e.availability !== "included") return false;
          if (onlyFree && e.availability !== "free") return false;
          if (onlyExclusive && !e.isExclusive) return false;
          if (day !== "all" && e.weeklyDay !== day) return false;
          if (onlySub && !isSubscribedService(e.serviceName, subKeys)) return false;
          return true;
        });
        return { ...w, matched: new Set(svcs.map((e) => e.serviceKey)) };
      })
      .filter((w) => w.matched.size > 0)
      .filter((w) => (qq ? w.title.toLowerCase().includes(qq) : true));

    list.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title, "ja");
      if (sort === "date")
        return (a.earliest ?? Infinity) - (b.earliest ?? Infinity);
      // day: 曜日→時刻の近い順（未設定は後ろ）
      const ad = a.days.size ? Math.min(...a.days) : 99;
      const bd = b.days.size ? Math.min(...b.days) : 99;
      return ad - bd;
    });
    return list;
  }, [works, svc, day, onlySub, onlyIncluded, onlyFree, onlyExclusive, q, sort, subKeys, lockedServiceKey]);

  const filtering =
    !!lockedServiceKey || svc.size > 0 || onlyIncluded || onlyFree || onlyExclusive || onlySub || day !== "all";

  const toggleSvc = (k: string) =>
    setSvc((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-bold transition ${
      on ? "bg-ink text-white" : "border border-line bg-white text-ink-2 hover:border-amber hover:text-ink"
    }`;

  return (
    <div>
      {/* 絞り込み */}
      <div className="mt-6 rounded-3xl border border-line bg-white p-4 lg:p-5">
        <label className="relative block">
          <span className="sr-only">作品名で絞り込み</span>
          <svg aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="作品名で絞り込み"
            className="w-full rounded-2xl border border-line bg-paper py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-ink-2/70 focus:border-amber focus:bg-white"
          />
        </label>

        {!lockedServiceKey && presentServices.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="配信サービスで絞り込み">
            {presentServices.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={svc.has(s.key)}
                onClick={() => toggleSvc(s.key)}
                className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs font-bold transition ${
                  svc.has(s.key) ? "bg-ink text-white" : "border border-line bg-white text-ink-2 hover:border-amber hover:text-ink"
                }`}
              >
                <ServiceIcon name={s.name} size={20} />
                {s.name}
                <span className={`num text-[11px] ${svc.has(s.key) ? "text-white/70" : "text-ink-2/80"}`}>{s.works}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <select
            value={day}
            aria-label="曜日"
            onChange={(e) => setDay(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink"
          >
            <option value="all">全曜日</option>
            {WD.map((w, i) => (
              <option key={i} value={i}>{w}曜</option>
            ))}
          </select>
          <button type="button" aria-pressed={onlyIncluded} onClick={() => setOnlyIncluded((v) => !v)} className={chip(onlyIncluded)}>見放題</button>
          <button type="button" aria-pressed={onlyFree} onClick={() => setOnlyFree((v) => !v)} className={chip(onlyFree)}>無料</button>
          <button type="button" aria-pressed={onlyExclusive} onClick={() => setOnlyExclusive((v) => !v)} className={chip(onlyExclusive)}>独占</button>
          {user && (
            <button type="button" aria-pressed={onlySub} onClick={() => setOnlySub((v) => !v)} className={chip(onlySub)}>契約中のみ</button>
          )}
          <span className="ml-auto flex items-center gap-2">
            <span className="text-xs text-ink-2" aria-live="polite">
              <span className="num font-bold text-ink">{shown.length}</span> 作品
            </span>
            <select
              value={sort}
              aria-label="並び順"
              onChange={(e) => setSort(e.target.value as "day" | "date" | "title")}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink"
            >
              <option value="day">曜日順</option>
              <option value="date">配信開始が早い順</option>
              <option value="title">作品名順</option>
            </select>
          </span>
        </div>
      </div>

      {/* 一覧 */}
      {shown.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-line bg-white p-10 text-center text-sm text-ink-2">
          <Mascot pose="worried" h={110} />
          <p>
            条件に一致する作品がありません。
            {onlySub && "「契約中のみ」を外すと増えることがあります。"}
          </p>
        </div>
      ) : (
        <>
          <p className="mt-5 flex items-center gap-1.5 text-[11px] text-ink-2">
            <span aria-hidden className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[8px] font-black text-ink shadow ring-1 ring-black/10">↗</span>
            が付いたアイコンを押すと、その配信サービスの作品ページが開きます。カードを押すと作品の詳しい配信情報へ。
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((w) => {
              const h = headline(w);
              const exclusive = w.services.filter((e) => e.isExclusive);
              const matched = w.matched ?? new Set<string>();
              return (
                <li key={w.anilistId}>
                  {/* カード全体を作品ページへのリンクにするが、<a> の中に <a>（配信サービスへのリンク）を
                      入れ子にはできないので、タイトルのリンクを透明に引き伸ばしてカード全体を覆う */}
                  <div className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-white transition hover:-translate-y-0.5 hover:border-amber/60 hover:shadow-[0_18px_40px_-24px_rgba(26,21,35,0.5)]">
                    <div className="flex gap-4 p-4 pb-3">
                      <div className="relative h-[118px] w-[84px] flex-none overflow-hidden rounded-xl bg-paper-2 ring-1 ring-black/5">
                        {w.coverImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={w.coverImage} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-3 text-[15px] font-black leading-snug text-ink group-hover:text-amber-ink">
                          <Link href={`/work/${w.anilistId}`} className="after:absolute after:inset-0 after:rounded-3xl after:content-['']">
                            {w.title}
                          </Link>
                        </p>
                        {(h.date || h.weekly) && (
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-2">
                            {h.date && (
                              <span>
                                <span className="num font-bold text-ink">{h.date}</span> から配信
                              </span>
                            )}
                            {h.weekly && <span className="num">{h.weekly}</span>}
                          </p>
                        )}
                        {(exclusive.length > 0 || h.fastest.length > 0) && (
                          <p className="mt-2 flex flex-wrap gap-1">
                            {exclusive.map((e) => (
                              <span key={e.serviceKey} className="rounded-full bg-[#FDEAEA] px-2 py-0.5 text-[10px] font-bold text-[#B91C1C]">
                                {e.serviceName} 独占
                              </span>
                            ))}
                            {h.fastest.length > 0 && (
                              <span className="rounded-full bg-[#EAF3DE] px-2 py-0.5 text-[10px] font-bold text-[#3B6D11]">
                                最速 {h.fastest.join("・")}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-auto border-t border-line/70 bg-paper/60 px-4 pb-3.5 pt-2.5">
                      <p className="mb-2 flex items-center justify-between text-[10px] font-bold text-ink-2">
                        <span>
                          見られるサービス <span className="num text-[12px] text-ink">{w.services.length}</span>
                        </span>
                        <span className="text-amber-ink group-hover:underline">詳しく見る ›</span>
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {w.services.map((e) => {
                          const dim = filtering && !matched.has(e.serviceKey);
                          const ring = e.isExclusive ? "ring-2 ring-[#E24B4A] ring-offset-1" : "";
                          return (
                            <li key={e.serviceKey} className={`relative ${dim ? "opacity-25" : ""}`}>
                              {e.watchUrl ? (
                                <a
                                  href={e.watchUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`${e.serviceName}で「${w.title}」を見る（新しいタブで開きます）`}
                                  title={`${e.serviceName}で見る`}
                                  className={`relative z-10 block rounded-[22%] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber ${ring}`}
                                >
                                  <ServiceIcon name={e.serviceName} size={28} />
                                  <span aria-hidden className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[8px] font-black text-ink shadow ring-1 ring-black/10">
                                    ↗
                                  </span>
                                </a>
                              ) : (
                                <span className={`block rounded-[22%] ${ring}`}>
                                  <ServiceIcon name={e.serviceName} size={28} />
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
