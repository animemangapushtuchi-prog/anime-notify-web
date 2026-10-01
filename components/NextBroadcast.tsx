"use client";

// 詳細ページの「次回のテレビ放送」。しょぼいカレンダー由来（局ごとに時刻が違うため）。
// ログイン中で視聴局を設定していれば、その局のうち最も早い放送を優先。無ければ全局から。
// ネット同時配信のチャンネルは lib/home.ts で除外する。
// しょぼいに一致が無ければ AniList の予定を「放送局確認中」として表示する。
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getTvPrograms, getUserChannels, nextBroadcast, type TvProgram } from "@/lib/home";

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
    <section className="relative mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 overflow-hidden rounded-3xl bg-night px-5 py-4 text-white lg:px-6">
      <div aria-hidden="true" className="starfield absolute inset-0 opacity-60" />
      <h2 className="relative flex items-center gap-2 text-xs font-bold text-white/60">
        <span className="h-2 w-2 animate-pulse-dot rounded-full bg-bell" />
        次回のテレビ放送
      </h2>
      <p className="relative flex flex-wrap items-baseline gap-x-3 text-lg font-black">
        {ep != null && <span>第<span className="num">{ep}</span>話</span>}
        <span className="num text-bell">{fmt(at)}</span>
        <span className="text-sm font-bold text-white/80">
          {useSyoboi ? prog!.ch : "放送局は確認中"}
        </span>
      </p>
      <p className="relative w-full text-[10px] text-white/60 sm:ml-auto sm:w-auto">
        {useSyoboi
          ? `出典：しょぼいカレンダー（${scoped ? "視聴局を反映" : "全局から最速"}）`
          : "出典：AniList（日本時間）／テレビ局は未確認"}
      </p>
    </section>
  );
}
