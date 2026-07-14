import Link from "next/link";
import { fetchSeasonPopular } from "@/lib/anilist";
import WorkCard from "@/components/WorkCard";

// ISR：1時間ごとに再生成（SEO対象のトップ一覧）
export const revalidate = 3600;

export default async function Home() {
  const items = await fetchSeasonPopular();
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="border-b border-black/10 pb-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold tracking-wide text-[#5B4FCF]">
            アニメ・漫画 新着通知
          </p>
          <Link
            href="/search"
            className="rounded-full bg-[#ECEAFD] px-3 py-1 text-xs font-bold text-[#5B4FCF]"
          >
            🔍 検索
          </Link>
        </div>
        <h1 className="mt-1 text-2xl font-extrabold text-[#1C1C2E]">
          今期のアニメ（人気順）
        </h1>
        <p className="mt-1 text-sm text-black/60">
          作品を選ぶと、配信サービス・PV・放送情報・公式リンクが見られます。
          登録すると新話や配信入りを通知します（ログイン機能は順次追加）。
        </p>
      </header>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-black/50">
          今期の作品を取得できませんでした。時間をおいて再読み込みしてください。
        </p>
      ) : (
        <section className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((a) => (
            <WorkCard key={a.id} {...a} />
          ))}
        </section>
      )}

      <p className="mt-8 text-[10px] text-black/40">出典：AniList</p>
    </main>
  );
}
