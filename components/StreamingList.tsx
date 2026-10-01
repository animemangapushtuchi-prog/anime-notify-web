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
  AVAILABILITY_JA,
  weeklyLabel,
} from "@/lib/seasonStreaming";
import ServiceIcon from "@/components/ServiceIcon";
import Mascot from "@/components/Mascot";

type Work = {
  anilistId: number;
  title: string;
  coverImage: string;
  services: PublicEntry[];
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
  return [...map.values()];
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
  const presentServices = useMemo(() => {
    const set = new Set(entries.map((e) => e.serviceKey));
    return STREAM_SERVICES.filter((s) => set.has(s.key));
  }, [entries]);

  const works = useMemo(() => groupByWork(entries), [entries]);

  const shown = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const list = works
      .map((w) => {
        // このカードで見せるサービスを絞り込み条件で間引く
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
        return { ...w, services: svcs };
      })
      .filter((w) => w.services.length > 0)
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
        <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((w) => {
            const exclusive = w.services.some((e) => e.isExclusive);
            return (
              <li key={w.anilistId}>
                {/* カード全体を作品ページへのリンクにするが、<a> の中に <a>（配信サービスへのリンク）を
                    入れ子にはできないので、タイトルのリンクを透明に引き伸ばしてカード全体を覆う */}
                <div className="group relative flex h-full gap-4 rounded-3xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-amber/60 hover:shadow-[0_18px_40px_-24px_rgba(26,21,35,0.5)]">
                  <div className="relative h-[120px] w-20 flex-none overflow-hidden rounded-xl bg-paper-2 ring-1 ring-black/5">
                    {w.coverImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.coverImage} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[15px] font-black leading-snug text-ink group-hover:text-amber-ink">
                      <Link href={`/work/${w.anilistId}`} className="after:absolute after:inset-0 after:rounded-3xl after:content-['']">
                        {w.title}
                      </Link>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-2">
                      {w.earliest != null && (
                        <span>
                          <span className="num font-bold text-ink">{mdLabel(w.earliest)}</span> 配信開始
                        </span>
                      )}
                      <span>
                        <span className="num font-bold text-ink">{w.services.length}</span> サービス
                      </span>
                      {exclusive && <span className="rounded-full bg-[#FDEAEA] px-2 py-0.5 font-bold text-[#B91C1C]">独占あり</span>}
                    </p>
                    <ul className="mt-2.5 flex flex-wrap gap-1.5">
                      {w.services.map((e) => {
                        const weekly = weeklyLabel(e.weeklyDay, e.weeklyTime);
                        const avail = AVAILABILITY_JA[e.availability];
                        const inner = (
                          <>
                            <ServiceIcon name={e.serviceName} size={16} />
                            <span>{e.serviceName}</span>
                            {avail && <span className="font-medium text-amber-ink">{avail}</span>}
                            {e.isExclusive && <span className="text-[#B91C1C]">独占</span>}
                            {e.isFastest && <span className="text-[#3B6D11]">最速</span>}
                            {weekly && <span className="num font-medium text-ink-2">{weekly.replace("毎週", "")}</span>}
                          </>
                        );
                        const cls =
                          "relative z-10 inline-flex items-center gap-1 rounded-full border bg-paper py-0.5 pl-0.5 pr-2 text-[11px] font-bold text-ink";
                        return (
                          <li key={e.serviceKey} className="flex">
                            {e.sourceUrl ? (
                              <a
                                href={e.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`${e.serviceName}：出典を開く`}
                                className={`${cls} ${e.isExclusive ? "border-[#F7C1C1]" : "border-line"} transition hover:border-amber hover:bg-white`}
                              >
                                {inner}
                              </a>
                            ) : (
                              <span className={`${cls} ${e.isExclusive ? "border-[#F7C1C1]" : "border-line"}`}>{inner}</span>
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
      )}
    </div>
  );
}
