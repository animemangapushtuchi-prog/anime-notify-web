import Link from "next/link";

// 全ページ共通のフッター。
// 利用規約・プライバシー・お問い合わせはこれまでプロフィールメニューの中だけにあり、
// 初めて来た人からは見つけられなかった。信頼性の表示として常に出しておく。
const LINK = "text-[#6B7280] hover:text-[#8A5518] hover:underline";

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-[#ECECF2] bg-white">
      <div className="mx-auto max-w-2xl px-4 py-8 lg:max-w-6xl lg:px-8">
        <nav className="grid gap-6 sm:grid-cols-3">
          <div>
            <h2 className="text-[11px] font-bold text-[#1C1C2E]">さがす</h2>
            <ul className="mt-2 space-y-1.5 text-xs">
              <li><Link href="/search" className={LINK}>作品を検索</Link></li>
              <li><Link href="/streaming" className={LINK}>今期アニメの配信一覧</Link></li>
              <li><Link href="/osusume" className={LINK}>おすすめ・特集</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="text-[11px] font-bold text-[#1C1C2E]">つかう</h2>
            <ul className="mt-2 space-y-1.5 text-xs">
              <li><Link href="/guide" className={LINK}>使い方ガイド</Link></li>
              <li><Link href="/calendar" className={LINK}>放送カレンダー</Link></li>
              <li><Link href="/login" className={LINK}>ログイン / 新規登録</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="text-[11px] font-bold text-[#1C1C2E]">このサイトについて</h2>
            <ul className="mt-2 space-y-1.5 text-xs">
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

        <p className="mt-6 text-[10px] leading-relaxed text-[#6B7280]">
          放送・配信情報は各配信サービス公式・AniList・しょぼいカレンダーをもとに掲載しています。
          最新の配信状況は各サービスの公式ページでご確認ください。
        </p>
        <p className="mt-2 text-[10px] text-[#6B7280]">
          © {new Date().getFullYear()} アニミル！（Animiru）
        </p>
      </div>
    </footer>
  );
}
