import Link from "next/link";
import type { PublicEntry } from "@/lib/seasonStreaming";
import { jstDateLabel, upcomingWorks } from "@/lib/workMeta";

// これから配信が始まる作品（確認済みの開始日が先の日付の行だけ）。無ければ何も出さない。
// 「2026年11月 配信予定」のような検索が増えているが、開始日が分かっている作品は月に数本なので、
// 月別の単独ページは作らず、読まれている季節・サービスのページの中に出す（薄いページを増やさないため）
export default function UpcomingStarts({ entries, showService = true }: { entries: PublicEntry[]; showService?: boolean }) {
  const list = upcomingWorks(entries);
  if (list.length === 0) return null;

  return (
    <section aria-labelledby="upcoming-h" className="mt-6 rounded-3xl border border-line bg-white p-5">
      <h2 id="upcoming-h" className="text-[15px] font-black text-ink">これから配信が始まる作品</h2>
      <ul className="mt-2 divide-y divide-line">
        {list.map((w) => (
          <li key={`${w.id}_${w.at}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-sm">
            <span className="num flex-none text-xs font-bold text-amber-ink">{jstDateLabel(w.at)}〜</span>
            <Link href={`/work/${w.id}`} className="font-bold text-ink hover:text-amber-ink hover:underline">{w.title}</Link>
            {showService && <span className="text-xs text-ink-2">{w.services.join("・")}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
