import Link from "next/link";
import Mascot from "./Mascot";

// 全ページ共通のフッター。
// 利用規約・プライバシー・お問い合わせはこれまでプロフィールメニューの中だけにあり、
// 初めて来た人からは見つけられなかった。信頼性の表示として常に出しておく。
// デザイン：ページの終わり＝夜更け。見張り番のミーアキャットが眠っている。
const LINK = "text-white/65 transition hover:text-white";

export default function Footer() {
  return (
    <footer className="relative isolate mt-16 overflow-hidden bg-night text-white lg:mt-24">
      <div aria-hidden="true" className="starfield absolute inset-0 -z-10 opacity-80" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_100%_0%,#2f2656_0%,transparent_70%)]"
      />
      <div className="mx-auto max-w-2xl px-4 pb-28 pt-12 lg:max-w-[1400px] lg:px-8 lg:pb-8 lg:pt-16">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-sm">
            <p className="palt font-display text-3xl font-black tracking-tight text-amber">
              アニミル<span className="text-collar">！</span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              アニメの放送・配信を、見逃さない。
              <br />
              見張り番のミーアキャットが、新しい話をお知らせします。
            </p>
          </div>
          <nav aria-label="フッター" className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:gap-14">
            <div>
              <h2 className="num text-[11px] font-bold uppercase tracking-[0.2em] text-bell">Explore</h2>
              <ul className="mt-3 space-y-2 text-[13px]">
                <li><Link href="/search" className={LINK}>作品を検索</Link></li>
                <li><Link href="/streaming" className={LINK}>今期アニメの配信一覧</Link></li>
                <li><Link href="/osusume" className={LINK}>特集・読みもの</Link></li>
              </ul>
            </div>
            <div>
              <h2 className="num text-[11px] font-bold uppercase tracking-[0.2em] text-bell">Use</h2>
              <ul className="mt-3 space-y-2 text-[13px]">
                <li><Link href="/guide" className={LINK}>使い方ガイド</Link></li>
                <li><Link href="/calendar" className={LINK}>放送カレンダー</Link></li>
                <li><Link href="/login" className={LINK}>ログイン / 新規登録</Link></li>
              </ul>
            </div>
            <div>
              <h2 className="num text-[11px] font-bold uppercase tracking-[0.2em] text-bell">About</h2>
              <ul className="mt-3 space-y-2 text-[13px]">
                <li><Link href="/terms" className={LINK}>利用規約</Link></li>
                <li><Link href="/privacy" className={LINK}>プライバシーポリシー</Link></li>
                <li>
                  <a href="mailto:animemangapushtuchi@gmail.com" className={LINK}>
                    お問い合わせ
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="mt-12 flex items-end justify-between gap-6 border-t border-white/10 pt-6">
          <div>
            <p className="text-[11px] leading-relaxed text-white/60">
              放送・配信情報は各配信サービス公式・作品公式サイト・AniList・しょぼいカレンダーをもとに掲載しています。
              最新の配信状況は各サービスの公式ページでご確認ください。
            </p>
            <p className="mt-2 text-[11px] text-white/60">
              © {new Date().getFullYear()} アニミル！（Animiru）
            </p>
          </div>
          <div aria-hidden="true" className="relative -mb-8 hidden flex-none sm:block">
            <Mascot pose="sleep" h={120} />
          </div>
        </div>
      </div>
    </footer>
  );
}
