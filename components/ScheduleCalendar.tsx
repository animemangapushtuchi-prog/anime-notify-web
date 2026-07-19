"use client";

// 放送カレンダー（週／月）。登録作品の次回放送(nextAiringEpisode)を曜日に投影して表示。
// 将来、配信の開始・終了タイミングが取れたら、月カレンダーに配信期間(帯)を重ねられる設計。
import { useMemo, useState } from "react";
import Link from "next/link";

export type AiringEntry = {
  id: number;
  title: string;
  cover: string;
  at: number; // 次回放送 UNIX秒
  ep: number | null;
  station: string;
};

const WD = ["日", "月", "火", "水", "木", "金", "土"];
const jst = (at: number) => new Date((at + 9 * 3600) * 1000);
const two = (n: number) => String(n).padStart(2, "0");
const hhmm = (at: number) => {
  const d = jst(at);
  return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
};
const weekday = (at: number) => jst(at).getUTCDay(); // 0=日..6=土

function EntryRow({ e }: { e: AiringEntry }) {
  return (
    <Link href={`/work/${e.id}`} className="flex items-center gap-2 py-1.5">
      {e.cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.cover} alt={e.title} className="h-10 w-7 flex-none rounded object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-[#1C1C2E]">{e.title}</p>
        <p className="text-[10px] text-[#6B7280]">
          {hhmm(e.at)}
          {e.ep != null ? `　第${e.ep}話` : ""}
          {e.station ? `　${e.station}` : ""}
        </p>
      </div>
    </Link>
  );
}

export default function ScheduleCalendar({ entries }: { entries: AiringEntry[] }) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selDay, setSelDay] = useState(-1); // 月表示で選択中の日（-1=今日）

  // 曜日ごとに束ねる（毎週同じ曜日に放送する前提で投影）
  const byWeekday = useMemo(() => {
    const m: AiringEntry[][] = [[], [], [], [], [], [], []];
    for (const e of entries) m[weekday(e.at)].push(e);
    for (const arr of m) arr.sort((a, b) => hhmm(a.at).localeCompare(hhmm(b.at)));
    return m;
  }, [entries]);

  const now = new Date();
  const todayW = now.getDay();

  // ---- 週表示：今週(月曜始まり)＋offset ----
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  weekStart.setDate(weekStart.getDate() - ((todayW + 6) % 7) + weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // ---- 月表示 ----
  const mBase = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const mYear = mBase.getFullYear();
  const mMonth = mBase.getMonth();
  const firstW = new Date(mYear, mMonth, 1).getDay();
  const daysIn = new Date(mYear, mMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstW; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const isToday = (d: number) =>
    monthOffset === 0 && d === now.getDate();
  const selectedDay = selDay > 0 ? selDay : monthOffset === 0 ? now.getDate() : 1;
  const selWeekday = new Date(mYear, mMonth, selectedDay).getDay();

  return (
    <div>
      {/* 週/月 切り替え */}
      <div className="flex gap-2">
        {(["week", "month"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              mode === m ? "bg-[#C2772A] text-white" : "bg-[#F6E9D5] text-[#C2772A]"
            }`}
          >
            {m === "week" ? "週" : "月"}
          </button>
        ))}
      </div>

      {entries.length === 0 && (
        <p className="mt-4 text-sm text-black/50">
          放送予定のある登録作品がありません（放送中の作品を登録すると、ここに予定が並びます）。
        </p>
      )}

      {mode === "week" ? (
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setWeekOffset((v) => v - 1)} className="px-3 py-1 text-sm font-bold text-[#C2772A]">◀</button>
            <span className="text-sm font-bold text-[#1C1C2E]">
              {weekOffset === 0 ? "今週" : `${weekDays[0].getMonth() + 1}/${weekDays[0].getDate()} の週`}
            </span>
            <button onClick={() => setWeekOffset((v) => v + 1)} className="px-3 py-1 text-sm font-bold text-[#C2772A]">▶</button>
          </div>
          <div className="mt-2 space-y-2">
            {weekDays.map((d) => {
              const list = byWeekday[d.getDay()];
              const today = d.toDateString() === now.toDateString();
              return (
                <div
                  key={d.toISOString()}
                  className={`rounded-2xl border p-3 ${today ? "border-[#C2772A]/40 bg-[#FBF3E6]" : "border-[#ECECF2] bg-white"}`}
                >
                  <p className="text-xs font-bold text-[#6B7280]">
                    {d.getMonth() + 1}/{d.getDate()}（{WD[d.getDay()]}）{today ? " ・今日" : ""}
                  </p>
                  {list.length === 0 ? (
                    <p className="mt-1 text-[11px] text-black/30">予定なし</p>
                  ) : (
                    <div className="mt-1 divide-y divide-[#F1F1F5]">
                      {list.map((e) => (
                        <EntryRow key={e.id} e={e} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <button onClick={() => { setMonthOffset((v) => v - 1); setSelDay(-1); }} className="px-3 py-1 text-sm font-bold text-[#C2772A]">◀</button>
            <span className="text-sm font-bold text-[#1C1C2E]">{mYear}年{mMonth + 1}月</span>
            <button onClick={() => { setMonthOffset((v) => v + 1); setSelDay(-1); }} className="px-3 py-1 text-sm font-bold text-[#C2772A]">▶</button>
          </div>
          <p className="mt-1 text-center text-[10px] text-[#6B7280]">
            作品画像を押すと詳細を開けます
          </p>

          <div className="mt-2 grid grid-cols-7 gap-1">
            {WD.map((w) => (
              <div key={w} className="py-1 text-center text-[10px] font-bold text-[#6B7280]">{w}</div>
            ))}
            {cells.map((d, i) => {
              if (d == null) return <div key={i} className="min-h-16 sm:min-h-24" />;
              const dayEntries = byWeekday[new Date(mYear, mMonth, d).getDay()];
              const sel = d === selectedDay;
              return (
                <div
                  key={i}
                  className={`min-h-16 rounded-lg border p-1 sm:min-h-24 ${
                    sel
                      ? "border-[#C2772A] bg-[#FBF3E6]"
                      : isToday(d)
                        ? "border-[#F3D9A9] bg-[#FFF9EE]"
                        : "border-[#ECECF2] bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelDay(d)}
                    aria-label={`${mMonth + 1}月${d}日の予定を表示`}
                    className={`block w-full text-left text-[10px] font-bold sm:text-xs ${
                      sel || isToday(d) ? "text-[#C2772A]" : "text-[#1C1C2E]"
                    }`}
                  >
                    {d}
                    {isToday(d) && <span className="ml-0.5 hidden text-[8px] sm:inline">今日</span>}
                  </button>
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {dayEntries.slice(0, 4).map((entry) => (
                      <Link
                        key={`${d}-${entry.id}`}
                        href={`/work/${entry.id}`}
                        title={`${entry.title} ${hhmm(entry.at)}`}
                        aria-label={`${entry.title}の詳細を開く`}
                        className="block"
                      >
                        {entry.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={entry.cover}
                            alt=""
                            className="h-5 w-5 rounded-sm object-cover ring-1 ring-black/5 sm:h-7 sm:w-7"
                          />
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-[#F6E9D5] text-[8px] font-bold text-[#C2772A] sm:h-7 sm:w-7">
                            {entry.title.slice(0, 1)}
                          </span>
                        )}
                      </Link>
                    ))}
                    {dayEntries.length > 4 && (
                      <button
                        type="button"
                        onClick={() => setSelDay(d)}
                        className="flex h-5 min-w-5 items-center justify-center rounded-sm bg-black/5 px-0.5 text-[8px] font-bold text-[#6B7280] sm:h-7"
                        aria-label={`${dayEntries.length - 4}作品をさらに表示`}
                      >
                        +{dayEntries.length - 4}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 rounded-2xl border border-[#ECECF2] bg-white p-3">
            <p className="text-xs font-bold text-[#6B7280]">
              {mMonth + 1}/{selectedDay}（{WD[selWeekday]}）の放送
            </p>
            {byWeekday[selWeekday].length === 0 ? (
              <p className="mt-1 text-[11px] text-black/30">予定なし</p>
            ) : (
              <div className="mt-1 divide-y divide-[#F1F1F5]">
                {byWeekday[selWeekday].map((e) => (
                  <EntryRow key={e.id} e={e} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
