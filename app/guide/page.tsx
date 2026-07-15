import Link from "next/link";

// 使い方ガイド（静的・7セクション）。プロフィールメニューから開く。
export const metadata = {
  title: "使い方ガイド｜アニメ・漫画 新着通知",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#ECECF2] bg-white p-4">
      <h2 className="text-sm font-extrabold text-[#1C1C2E]">{title}</h2>
      <div className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-black/70">
        {children}
      </div>
    </section>
  );
}

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-extrabold text-[#1C1C2E]">🔰 使い方ガイド</h1>
      <p className="mt-1 text-sm text-black/60">
        登録した作品の「新話の放送」「配信入り」を自動で通知するアプリです。
      </p>

      <div className="mt-4 space-y-3">
        <Section title="① はじめかた">
          <p>
            右上の人型アイコン →「ログイン」からアカウントを作成します（ID＋パスワードだけ）。
            未ログインでも「検索」から作品やPV・配信情報は見られます。
          </p>
        </Section>

        <Section title="② ホーム">
          <p>
            登録した作品の一覧です。各作品の「次の予定（第◯話・放送日時・放送局）」や配信サービスが表示されます。
            右上のソートで並び替え、「編集」で解除ができます（登録は10件まで）。
          </p>
        </Section>

        <Section title="③ 検索・登録">
          <p>
            下タブの「検索」から作品を探せます。チップ（アニメ/漫画/今期放送中…）やジャンルのタグ、ソートで絞り込み。
            作品を開いて「＋ 登録して新着通知を受け取る」で登録できます。
          </p>
        </Section>

        <Section title="④ 通知の仕組み">
          <p>
            サーバーが毎日、登録作品の「新話の放送」「配信入り」を自動でチェックし、通知します。
            「通知」タブに履歴が残ります。設定で通知のON/OFF（全体・種別ごと）を切り替えられます。
          </p>
        </Section>

        <Section title="⑤ ブラウザ通知（iPhoneの方は特に重要）">
          <p>
            設定 →「ブラウザ通知を有効にする」でこの端末に通知が届きます。
          </p>
          <p className="font-bold text-[#DC2626]">
            iPhoneの場合：Safariで開き「ホーム画面に追加」してから、追加したアイコンで開かないと通知が使えません（iOSの仕様です）。
          </p>
        </Section>

        <Section title="⑥ データと安全性">
          <p>
            パスワードはGoogleの認証基盤が管理し、開発者にも見えません。集めるのはID・登録作品・通知設定・履歴・配達用トークンのみで、メール・本名・位置情報は集めません。
            データは本人以外読めないようDBルールで守られています。通知は設定OFFかログアウトで完全に止まります。
          </p>
        </Section>

        <Section title="⑦ よくある質問">
          <p>
            <span className="font-bold">Q. 通知が来ない？</span> → 設定でブラウザ通知が有効か、通知トグルがONかを確認。iPhoneはホーム画面追加が必要です。
          </p>
          <p>
            <span className="font-bold">Q. 検索で出ない？</span> → 表記ゆれ（ひらがな/カタカナ/英語）を変えてみてください。
          </p>
          <p>
            <span className="font-bold">Q. 海外の配信しか出ない？</span> → 地域制限のある海外専用サービスは、日本のユーザー向けに非表示にしています。
          </p>
        </Section>
      </div>

      <Link href="/" className="mt-5 inline-block text-sm font-bold text-[#5B4FCF]">
        ← ホームへ
      </Link>
    </main>
  );
}
