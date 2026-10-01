import Link from "next/link";
import Mascot from "@/components/Mascot";

export default function NotFound() {
  return (
    <main className="px-3 pb-6 pt-3 sm:px-4 lg:px-8 lg:pt-0">
      <section className="relative isolate mx-auto flex max-w-4xl flex-col items-center overflow-hidden rounded-[28px] bg-night px-6 py-16 text-center text-white lg:py-24">
        <div aria-hidden="true" className="starfield absolute inset-0 -z-10 animate-twinkle" />
        <p className="num text-[64px] font-black leading-none tracking-tight text-white/15 lg:text-[96px]">404</p>
        <Mascot pose="worried" h={150} eager className="-mt-6" />
        <h1 className="mt-6 text-[26px] font-black leading-snug lg:text-[32px]">ページが見つかりません</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
          見張り番のミーアキャットにも見つけられませんでした。
          お探しのページは移動または削除された可能性があります。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-full bg-bell px-6 py-3 text-sm font-black text-night transition hover:-translate-y-0.5">
            ホームに戻る
          </Link>
          <Link href="/search" className="rounded-full px-5 py-3 text-sm font-bold text-white ring-1 ring-white/25 transition hover:bg-white/10">
            作品をさがす
          </Link>
        </div>
      </section>
    </main>
  );
}
