"use client";

// 詳細ページの「次回の放送」。しょぼいカレンダー由来（局ごとに時刻が違うため）。
// ログイン中で視聴局を設定していれば、その局のうち最も早い放送を優先。無ければ全局から。
// しょぼいに一致が無ければ AniList の次回放送にフォールバック。
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getTvPrograms, getUserChannels, nextBroadcast, type TvProgram } from "@/lib/home";

const CARD_TITLE = "text-[13px] font-bold text-[#6B7280]";
const WD = ["日", "月", "火", "水", "木", "金", "土"];

// 深夜アニメの 24〜28時表記に補正して整形（例：木1:00 → 水25:00）
function fmt(st: number): string {
  const d = new Date((st + 9 * 3600) * 1000);
  let hh = d.getUTCHours();
  let dd = d;
  if (hh < 5) {
    hh += 24;
    dd = new Date(d.getTime() - 86400000);
  }
  const two = (n: number) => String(n).padStart(2, "0");
  return `${dd.getUTCMonth() + 1}/${dd.getUTCDate()}（${WD[dd.getUTCDay()]}）${hh}:${two(d.getUTCMinutes())}`;
}

export default function NextBroadcast({
  title,
  fallbackAt,
  fallbackEp,
}: {
  title: string;
  fallbackAt: number | null;
  fallbackEp: number | null;
}) {
  const { user } = useAuth();
  const [prog, setProg] = useState<TvProgram | null | undefined>(undefined); // undefined=読込中
  const [scoped, setScoped] = useState(false); // 視聴局で絞れたか

  useEffect(() => {
    let alive = true;
    (async () => {
      const progs = await getTvPrograms().catch(() => [] as TvProgram[]);
      const channels = user ? await getUserChannels(user.uid).catch(() => []) : [];
      let np = channels.length ? nextBroadcast(title, progs, channels) : null;
      const isScoped = !!np;
      if (!np) np = nextBroadcast(title, progs);
      if (alive) {
        setProg(np ?? null);
        setScoped(isScoped);
      }
    })();
    return () => {
      alive = false;
    };
  }, [title, user]);

  // 読込中でフォールバックも無いときは何も出さない（レイアウト揺れ防止）
  if (prog === undefined && fallbackAt == null) return null;
  // しょぼいにも AniList にも無い → 出さない
  if (prog === null && fallbackAt == null) return null;

  const useSyoboi = !!prog;
  const ep = useSyoboi ? prog!.count : fallbackEp;
  const at = useSyoboi ? prog!.st : (fallbackAt as number);

  return (
    <section className="mt-4 rounded-2xl border border-[#F3D9A9] bg-[#E8F0FE] p-4">
      <h2 className={CARD_TITLE}>📅 次回の放送</h2>
      <p className="mt-1 text-base font-extrabold text-[#1C1C2E]">
        {ep != null ? `第${ep}話　` : ""}
        {fmt(at)}
        {useSyoboi && <span className="ml-2 text-sm font-bold text-[#5B4FCF]">{prog!.ch}</span>}
      </p>
      <p className="mt-1 text-[10px] text-[#6B7280]">
        {useSyoboi
          ? `出典：しょぼいカレンダー（${scoped ? "視聴局を反映" : "全局から最速"}）`
          : "出典：AniList（日本時間）"}
      </p>
    </section>
  );
}
