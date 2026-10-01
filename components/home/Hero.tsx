import Link from "next/link";
import Mascot from "@/components/Mascot";
import { lateNightTime, type Tonight } from "@/lib/tonight";

// トップの見出し。夜空の下でミーアキャット（見張り番）が、今夜の放送を見張っている。
// 下の帯は「今夜の放送」の実データ（しょぼいカレンダー由来）。データが無ければ帯ごと出さない。
function hueOf(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export default function Hero({ tonight }: { tonight: Tonight }) {
  const items = tonight.items.slice(0, 24);
  return (
    <section className="mx-auto max-w-[1400px] px-3 pt-3 sm:px-4 lg:px-8 lg:pt-0" aria-labelledby="hero-title">
      <div className="relative isolate overflow-hidden rounded-[28px] bg-night text-white shadow-[0_30px_80px_-40px_rgba(21,17,42,0.9)]">
        {/* 背景：上の藍色・右下の月明かり・星 */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_0%_0%,#2f2656_0%,transparent_60%),radial-gradient(70%_70%_at_85%_105%,rgba(232,179,60,0.32)_0%,transparent_60%)]"
        />
        <div aria-hidden="true" className="starfield absolute inset-0 -z-10 animate-twinkle" />
        <div
          aria-hidden="true"
          className="starfield absolute inset-0 -z-10 rotate-180 animate-twinkle [animation-delay:-2s]"
        />
        {/* 月 */}
        <div
          aria-hidden="true"
          className="absolute -right-6 -top-6 -z-10 h-24 w-24 rounded-full bg-[#fff3d6] opacity-90 shadow-[0_0_60px_20px_rgba(255,226,160,0.22)] sm:right-24 sm:top-8 lg:right-40 lg:top-10 lg:h-28 lg:w-28"
        >
          <span className="absolute left-[18%] top-[30%] h-5 w-5 rounded-full bg-[#f1e2bd]" />
          <span className="absolute left-[55%] top-[58%] h-3 w-3 rounded-full bg-[#f1e2bd]" />
        </div>

        <div className="grid items-end gap-2 md:grid-cols-[1.25fr_0.75fr]">
          <div className="relative z-10 px-6 pb-8 pt-8 sm:px-10 lg:px-14 lg:pb-12 lg:pt-14">
            {items.length > 0 && (
              <p className="inline-flex items-center gap-2 rounded-full bg-night/70 py-1 pl-2.5 pr-3.5 text-xs font-bold text-[#fbe7bf] ring-1 ring-white/15 backdrop-blur">
                <span className="h-2 w-2 animate-pulse-dot rounded-full bg-bell" />
                {tonight.label} {tonight.dateLabel} のテレビ放送
                <span className="num text-white">{tonight.items.length}</span>作品
              </p>
            )}
            <h1
              id="hero-title"
              className="mt-5 text-[34px] font-black leading-[1.22] tracking-tight sm:text-5xl lg:text-[60px] lg:leading-[1.14] xl:text-[68px]"
            >
              <span className="inline-block">アニメの</span>
              <span className="inline-block">放送・配信を、</span>
              <br />
              <span className="bg-gradient-to-r from-[#ffd88a] via-[#f3b552] to-[#e8853c] bg-clip-text text-transparent">
                見逃さない。
              </span>
            </h1>
            <p className="mt-5 max-w-[36em] text-sm leading-[1.9] text-white/75 lg:text-[15px]">
              気になる作品を登録しておくと、新しい話の放送日と、配信サービスに入った日を
              アニミル！が自動でお知らせします。放送カレンダー・今期の配信一覧・特集記事は
              ログインなしで見られます。
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/search"
                className="group inline-flex items-center gap-2 rounded-full bg-bell px-6 py-3 text-sm font-black text-night shadow-[0_10px_30px_-10px_rgba(232,179,60,0.8)] transition hover:-translate-y-0.5 hover:bg-[#f2c45a]"
              >
                見張る作品をさがす
                <span aria-hidden="true" className="transition group-hover:translate-x-0.5">→</span>
              </Link>
              <Link
                href="/streaming"
                className="inline-flex items-center rounded-full px-5 py-3 text-sm font-bold text-white ring-1 ring-white/25 transition hover:bg-white/10"
              >
                今期の配信一覧
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-white/65">登録なしで5作品まで・無料で使えます</p>
          </div>

          {/* 見張り番のミーアキャット。鈴のまわりに「チリン」という波紋を出す */}
          <div aria-hidden="true" className="pointer-events-none relative hidden h-full min-h-[360px] items-end justify-center md:flex">
            <div className="absolute bottom-0 left-1/2 h-16 w-[120%] -translate-x-1/2 translate-y-1/2 rounded-[50%] bg-night-3" />
            <div className="relative mb-6 animate-float">
              <Mascot pose="stand" h={330} eager className="relative drop-shadow-[0_20px_30px_rgba(0,0,0,0.45)]" />
              <span className="absolute left-[53%] top-[37%] h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-bell/70 [animation:pulse-dot_2.4s_ease-out_infinite]" />
              <svg className="absolute -right-10 top-[26%] h-16 w-12 animate-ring origin-left text-bell" viewBox="0 0 48 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M8 22c6 6 6 14 0 20" opacity="0.9" />
                <path d="M18 14c10 10 10 26 0 36" opacity="0.6" />
                <path d="M28 6c14 14 14 38 0 52" opacity="0.35" />
              </svg>
            </div>
          </div>
        </div>

        {/* 今夜の放送 */}
        {items.length > 0 && (
          <div className="relative z-10 border-t border-white/10 bg-black/20 backdrop-blur-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-6 pt-5 sm:px-10 lg:px-14">
              <h2 className="text-sm font-black tracking-wide text-white">
                {tonight.label}の放送
                <span className="ml-2 whitespace-nowrap text-xs font-bold text-white/60">{tonight.dateLabel}</span>
              </h2>
              <p className="text-[10px] text-white/60">出典：しょぼいカレンダー<span className="hidden sm:inline">（深夜は24時以降の表記）</span></p>
            </div>
            <ol className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-6 pb-6 pt-4 [mask-image:linear-gradient(90deg,transparent,#000_24px,#000_calc(100%-48px),transparent)] sm:px-10 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-14 lg:[mask-image:none]">
              {items.map((it, idx) => {
                const body = (
                  <>
                    <div className="relative h-[72px] w-12 flex-none overflow-hidden rounded-lg bg-white/10">
                      {it.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <span
                          className="font-display flex h-full items-center justify-center text-xl font-black text-white/90"
                          style={{ background: `linear-gradient(160deg, hsl(${hueOf(it.title)} 45% 42%), hsl(${(hueOf(it.title) + 40) % 360} 50% 22%))` }}
                        >
                          {it.title.slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="num text-xl font-bold leading-none text-bell">{lateNightTime(it.st)}</p>
                      <p className="mt-1.5 line-clamp-2 text-[13px] font-bold leading-snug text-white">{it.title}</p>
                      <p className="mt-1 truncate text-[11px] text-white/65">
                        {it.ch}
                        {it.chCount > 1 ? ` ほか${it.chCount - 1}局` : ""}
                        {it.ep != null ? ` ・第${it.ep}話` : ""}
                      </p>
                    </div>
                  </>
                );
                const cls =
                  "flex h-full w-[236px] gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10 transition lg:w-auto";
                return (
                  <li key={`${it.title}-${it.st}`} className={`flex-none snap-start ${idx >= 8 ? "lg:hidden" : ""}`}>
                    {it.workId ? (
                      <Link href={`/work/${it.workId}`} className={`${cls} hover:bg-white/[0.12] hover:ring-white/25`}>
                        {body}
                      </Link>
                    ) : (
                      <div className={cls}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ol>
            {tonight.items.length > 8 && (
              <p className="-mt-2 hidden px-14 pb-6 text-xs text-white/60 lg:block">
                ほか <span className="num font-bold text-white">{tonight.items.length - 8}</span> 作品が放送予定です
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
