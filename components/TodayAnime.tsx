"use client";

// 登録作品のうち、今日放送される作品をカレンダー上部にまとめて表示する。
import Link from "next/link";
import type { AiringEntry } from "@/components/ScheduleCalendar";

const WD = ["日", "月", "火", "水", "木", "金", "土"];
const two = (n: number) => String(n).padStart(2, "0");
const jst = (at: number) => new Date((at + 9 * 3600) * 1000);
const dateKey = (at: number) => {
  const d = jst(at);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
};
const timeLabel = (at: number) => {
  const d = jst(at);
  return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
};
const dateLabel = (at: number) => {
  const d = jst(at);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WD[d.getUTCDay()]}）`;
};

function remainingLabel(at: number, now: number): string {
  const minutes = Math.max(0, Math.floor((at - now) / 60));
  if (minutes < 60) return minutes <= 5 ? "まもなく" : `あと${minutes}分`;
  if (minutes < 24 * 60) return `あと${Math.floor(minutes / 60)}時間`;
  return dateLabel(at);
}

function TodayRow({ entry, now }: { entry: AiringEntry; now: number }) {
  return (
    <Link
      href={`/work/${entry.id}`}
      className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 transition hover:bg-[#FFFCF7]"
    >
      <div className="w-12 flex-none text-center">
        <p className="text-sm font-extrabold text-[#1C1C2E]">{timeLabel(entry.at)}</p>
        <p className="mt-0.5 text-[9px] font-bold text-[#C2772A]">
          {remainingLabel(entry.at, now)}
        </p>
      </div>
      {entry.cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.cover} alt={entry.title} className="h-12 w-8 flex-none rounded object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-[#1C1C2E]">{entry.title}</p>
        <p className="mt-0.5 truncate text-[10px] text-[#6B7280]">
          {entry.ep != null ? `第${entry.ep}話` : "新話"}
          {entry.station ? `　${entry.station}` : "　放送局は確認中"}
        </p>
      </div>
      <span className="flex-none text-sm text-[#C2772A]">›</span>
    </Link>
  );
}

export default function TodayAnime({
  entries,
  loading,
}: {
  entries: AiringEntry[];
  loading: boolean;
}) {
  const now = Math.floor(Date.now() / 1000);
  const today = dateKey(now);
  const future = entries.filter((entry) => entry.at >= now).sort((a, b) => a.at - b.at);
  const todayEntries = future.filter((entry) => dateKey(entry.at) === today);
  const next = future.find((entry) => dateKey(entry.at) !== today);

  return (
    <section className="mt-4 rounded-2xl border border-[#F3D9A9] bg-[#FBF3E6] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-extrabold text-[#1C1C2E]">今日のアニメ</p>
          <p className="text-[10px] text-[#6B7280]">登録作品のテレビ放送</p>
        </div>
        {todayEntries.length > 0 && (
          <span className="rounded-full bg-[#C2772A] px-2.5 py-1 text-[10px] font-bold text-white">
            {todayEntries.length}作品
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-3 h-16 animate-pulse rounded-xl bg-white/80" />
      ) : todayEntries.length > 0 ? (
        <div className="mt-3 space-y-2">
          {todayEntries.map((entry) => (
            <TodayRow key={`${entry.id}-${entry.at}`} entry={entry} now={now} />
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-white px-3 py-3">
          <p className="text-sm font-bold text-[#1C1C2E]">今日はテレビ放送の予定がありません</p>
          {next ? (
            <Link href={`/work/${next.id}`} className="mt-2 flex items-center gap-2 text-xs">
              <span className="flex-none font-bold text-[#C2772A]">次は {dateLabel(next.at)}</span>
              <span className="min-w-0 flex-1 truncate text-[#1C1C2E]">
                {timeLabel(next.at)}　{next.title}
              </span>
              <span className="text-[#C2772A]">›</span>
            </Link>
          ) : (
            <p className="mt-1 text-[11px] text-[#6B7280]">
              放送中の作品を登録すると、ここに予定が表示されます。
            </p>
          )}
        </div>
      )}
    </section>
  );
}
