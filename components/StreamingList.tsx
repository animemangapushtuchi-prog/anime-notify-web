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
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const chip = (on: boolean) =>
    `rounded-full px-3 py-1 text-xs font-bold transition ${
      on ? "bg-[#C2772A] text-white" : "border border-[#ECECF2] bg-white text-[#6B7280]"
    }`;

  return (
    <div>
      {/* 絞り込み */}
      <div className="mt-4 space-y-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="作品名で絞り込み"
          className="w-full rounded-xl border border-[#ECECF2] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#C2772A]"
        />

        {!lockedServiceKey && presentServices.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {presentServices.map((s) => (
              <button key={s.key} type="button" onClick={() => toggleSvc(s.key)} className={chip(svc.has(s.key))}>
                {s.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={day}
            onChange={(e) => setDay(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="rounded-full border border-[#ECECF2] bg-white px-3 py-1 text-xs font-bold text-[#1C1C2E]"
          >
            <option value="all">全曜日</option>
            {WD.map((w, i) => (
              <option key={i} value={i}>{w}曜</option>
            ))}
          </select>
          <button type="button" onClick={() => setOnlyIncluded((v) => !v)} className={chip(onlyIncluded)}>見放題</button>
          <button type="button" onClick={() => setOnlyFree((v) => !v)} className={chip(onlyFree)}>無料</button>
          <button type="button" onClick={() => setOnlyExclusive((v) => !v)} className={chip(onlyExclusive)}>独占</button>
          {user && (
            <button type="button" onClick={() => setOnlySub((v) => !v)} className={chip(onlySub)}>契約中のみ</button>
          )}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "day" | "date" | "title")}
            className="ml-auto rounded-full border border-[#ECECF2] bg-white px-3 py-1 text-xs font-bold text-[#1C1C2E]"
          >
            <option value="day">曜日順</option>
            <option value="date">配信開始が早い順</option>
            <option value="title">作品名順</option>
          </select>
        </div>
      </div>

      {/* 一覧 */}
      {shown.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-[#ECECF2] bg-white p-8 text-center text-sm text-black/50">
          <Mascot pose="worried" h={110} />
          <p>
            条件に一致する作品がありません。
            {onlySub && "「契約中のみ」を外すと増えることがあります。"}
          </p>
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((w) => (
            <li key={w.anilistId}>
              <Link
                href={`/work/${w.anilistId}`}
                className="flex gap-3 rounded-2xl border border-[#ECECF2] bg-white p-3 hover:border-[#C2772A]"
              >
                {w.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.coverImage} alt={w.title} className="h-24 w-16 flex-none rounded-md object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-bold text-[#1C1C2E]">{w.title}</p>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {w.services.map((e) => (
                      <div key={e.serviceKey} className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
                        <ServiceIcon name={e.serviceName} size={16} />
                        <span className="font-bold text-[#1C1C2E]">{e.serviceName}</span>
                        {AVAILABILITY_JA[e.availability] && (
                          <span className="rounded bg-[#F6E9D5] px-1.5 py-0.5 font-bold text-[#8A5518]">
                            {AVAILABILITY_JA[e.availability]}
                          </span>
                        )}
                        {e.isExclusive && <span className="rounded bg-[#FDEAEA] px-1.5 py-0.5 font-bold text-[#DC2626]">独占</span>}
                        {e.isFastest && <span className="rounded bg-[#EAF3DE] px-1.5 py-0.5 font-bold text-[#3B6D11]">最速</span>}
                        {weeklyLabel(e.weeklyDay, e.weeklyTime) && (
                          <span className="text-[10px] text-black/40">{weeklyLabel(e.weeklyDay, e.weeklyTime)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
