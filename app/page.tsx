import FirebaseStatus from "@/components/FirebaseStatus";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col items-start justify-center px-6 py-16">
      <p className="text-sm font-semibold tracking-wide text-[#5B4FCF]">
        アニメ・漫画 新着通知
      </p>
      <h1 className="mt-2 text-3xl font-extrabold text-[#1C1C2E]">
        Next.js 版・土台（Phase 0）
      </h1>
      <p className="mt-4 leading-relaxed text-black/60">
        登録した作品の新話放送・配信入りを自動で通知するアプリの Web 版を、
        Next.js で作り直しています。まずは土台が動くことを確認する画面です。
        ここから 一覧・作品詳細（SEO対応）→ ログイン → 通知 の順に作っていきます。
      </p>
      <FirebaseStatus />
    </main>
  );
}
