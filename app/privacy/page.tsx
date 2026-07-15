import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー | Animiru",
  description:
    "Animiru（アニメ・漫画 新着通知サービス）における個人情報・Cookie・広告（Google AdSense）の取り扱いについて定めたプライバシーポリシーです。",
};

const REVISED = "2026年7月15日";

function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[15px] font-bold text-[#1C1C2E]">{title}</h2>
      <div className="mt-1.5 space-y-2 text-[13px] leading-relaxed text-[#374151]">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-[#1C1C2E]">プライバシーポリシー</h1>
      <p className="mt-1 text-xs text-[#6B7280]">最終改定日：{REVISED}</p>

      <div className="mt-6 space-y-6">
        <p className="text-[13px] leading-relaxed text-[#374151]">
          Animiru運営（以下「当運営者」）は、ウェブサービス「Animiru」（animiru.com。以下「本サービス」）における、ユーザーの情報の取り扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」）を定めます。
        </p>

        <Article title="1. 取得する情報">
          <p>本サービスは、以下の情報を取得することがあります。</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>ユーザーが登録するID、およびパスワード（パスワードは認証基盤（Google Firebase Authentication）により暗号化して管理され、当運営者が内容を閲覧・保持することはありません）</li>
            <li>ユーザーが登録した作品、通知設定、通知履歴などのサービス利用情報</li>
            <li>プッシュ通知の送信に必要な通知トークン（FCM登録トークン）および端末・ブラウザの種別</li>
            <li>アクセス日時、リファラ、IPアドレス、ブラウザ・OSの種類等のアクセスログ</li>
            <li>Cookieおよびこれに類する技術によって収集される情報</li>
          </ol>
        </Article>

        <Article title="2. 利用目的">
          <p>取得した情報は、次の目的で利用します。</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>本サービスの提供・維持・本人認証のため</li>
            <li>登録作品に関する放送・配信情報のプッシュ通知を送信するため</li>
            <li>本サービスの品質改善、新機能の検討、不具合対応のため</li>
            <li>利用状況の分析（アクセス解析）のため</li>
            <li>広告の配信・表示のため</li>
            <li>規約違反行為への対応、その他本サービスの安全な運営のため</li>
          </ol>
        </Article>

        <Article title="3. Cookie（クッキー）について">
          <p>
            本サービスは、ユーザーの利便性向上、ログイン状態の保持、アクセス解析および広告配信のためにCookieを使用することがあります。ユーザーは、ご利用のブラウザ設定でCookieを無効化できますが、その場合、本サービスの一部機能が利用できなくなることがあります。
          </p>
        </Article>

        <Article title="4. 広告配信（Google AdSense等）について">
          <p>
            本サービスは、第三者配信の広告サービスとして Google AdSense を利用することがあります。
          </p>
          <p>
            Googleなどの第三者配信事業者は、Cookieを使用して、ユーザーが本サービスや他のウェブサイトに過去にアクセスした際の情報に基づき、適切な広告を表示します。
          </p>
          <p>
            ユーザーは、Googleの
            <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="font-bold text-[#5B4FCF] underline">広告設定</a>
            にアクセスすることで、パーソナライズ広告（興味・関心に基づく広告）を無効にできます。また、
            <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="font-bold text-[#5B4FCF] underline">www.aboutads.info</a>
            にアクセスすれば、第三者配信事業者のCookieを無効にできます。
          </p>
          <p>
            Googleによる広告Cookieの利用については、
            <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" className="font-bold text-[#5B4FCF] underline">Googleの広告に関するポリシー</a>
            もあわせてご確認ください。
          </p>
        </Article>

        <Article title="5. アクセス解析について">
          <p>
            本サービスは、利用状況を把握し品質改善に役立てるため、アクセス解析ツール（Vercel Analytics 等）を利用することがあります。これらのツールは、トラフィックデータの収集のためにCookie等を使用する場合があります。収集される情報は匿名で扱われ、個人を特定するものではありません。
          </p>
        </Article>

        <Article title="6. プッシュ通知について">
          <p>
            本サービスは、通知の送信に Google Firebase Cloud Messaging（FCM）を利用します。通知の受信には端末・ブラウザごとの通知トークンが必要です。通知が不要になった場合は、本サービスの設定またはブラウザ・OSの通知設定から、いつでも通知を無効にできます。
          </p>
        </Article>

        <Article title="7. 第三者への提供・業務委託">
          <p>
            当運営者は、法令に基づく場合を除き、あらかじめユーザーの同意を得ずに個人情報を第三者に提供しません。ただし、本サービスの運営に必要な範囲で、以下の外部サービスを利用しており、これに伴い情報が各社の管理するサーバーに保存・処理されることがあります。
          </p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>Google（Firebase Authentication / Cloud Firestore / Cloud Messaging）— 認証・データ保存・通知配信</li>
            <li>Vercel — ホスティングおよびアクセス解析</li>
            <li>Google AdSense — 広告配信</li>
          </ol>
          <p>各社における情報の取り扱いは、それぞれのプライバシーポリシーに従います。</p>
        </Article>

        <Article title="8. 情報の保存期間と削除">
          <p>
            登録情報は、アカウントが有効な間、本サービスの提供に必要な範囲で保存されます。ユーザーがアカウントを削除した場合、または当運営者が保存の必要がないと判断した場合、当該情報は合理的な期間内に削除されます。アカウントや登録データの削除をご希望の場合は、第10条のお問い合わせ先までご連絡ください。
          </p>
        </Article>

        <Article title="9. 未成年者の利用">
          <p>
            未成年者が本サービスを利用する場合は、保護者の同意を得たうえでご利用ください。当運営者は、必要に応じて年齢に配慮した対応を行うことがあります。
          </p>
        </Article>

        <Article title="10. 改定・お問い合わせ">
          <p>
            当運営者は、法令の変更やサービス内容の変更に応じて、本ポリシーを改定することがあります。改定後の本ポリシーは、本サービス上に掲載した時点から効力を生じます。
          </p>
          <p>
            本ポリシーに関するお問い合わせは、次の連絡先までお願いします。<br />
            Animiru運営
            <a href="mailto:animemangapushtuchi@gmail.com" className="font-bold text-[#5B4FCF] underline">
              animemangapushtuchi@gmail.com
            </a>
          </p>
        </Article>
      </div>
    </main>
  );
}
