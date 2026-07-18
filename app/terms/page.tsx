import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "利用規約 | Animiru",
  description: "Animiru（アニメ・漫画 新着通知サービス）の利用規約です。",
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

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-[#1C1C2E]">利用規約</h1>
      <p className="mt-1 text-xs text-[#6B7280]">最終改定日：{REVISED}</p>

      <div className="mt-6 space-y-6">
        <p className="text-[13px] leading-relaxed text-[#374151]">
          この利用規約（以下「本規約」）は、Animiru運営（以下「当運営者」）が提供するウェブサービス「Animiru」（
          <span className="whitespace-nowrap">animiru.com</span>
          。以下「本サービス」）の利用条件を定めるものです。利用者（以下「ユーザー」）は、本サービスを利用することで本規約に同意したものとみなされます。
        </p>

        <Article title="第1条（適用）">
          <p>本規約は、本サービスの提供条件およびユーザーと当運営者との間の権利義務関係に適用されます。当運営者が本サービス上に掲載する個別の注意事項・案内も、本規約の一部を構成します。</p>
        </Article>

        <Article title="第2条（本サービスの内容）">
          <p>
            本サービスは、ユーザーが登録したアニメ・漫画等の作品について、新話の放送・配信入りなどの情報をプッシュ通知等でお知らせする、情報提供サービスです。
          </p>
          <p>
            放送・配信・作品に関する情報は、AniList、しょぼいカレンダー、Wikipedia等の外部サービスや公開情報をもとに自動的に取得・生成しています。当運営者はこれらの情報の正確性・完全性・最新性を保証しません。
          </p>
        </Article>

        <Article title="第3条（アカウント登録）">
          <p>
            本サービスの一部機能は、ユーザーIDとパスワードによる登録を必要とします。ユーザーは、自己の責任でIDおよびパスワードを管理するものとし、第三者に利用させ、または貸与・譲渡してはなりません。
          </p>
          <p>
            IDおよびパスワードの管理不十分、使用上の過誤、第三者の使用等によって生じた損害の責任はユーザーが負うものとし、当運営者は責任を負いません。
          </p>
        </Article>

        <Article title="第4条（通知に関する免責）">
          <p>
            プッシュ通知は、外部データの取得状況、各配信事業者・OS・ブラウザ・端末の仕様、通信環境等の影響を受けるため、通知の到達・タイミング・内容を保証するものではありません（ベストエフォート型のサービスです）。
          </p>
          <p>通知の遅延・不達・重複・誤りによってユーザーに生じた損害について、当運営者は責任を負いません。</p>
        </Article>

        <Article title="第5条（禁止事項）">
          <p>ユーザーは、本サービスの利用にあたり、次の行為をしてはなりません。</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>法令または公序良俗に違反する行為</li>
            <li>当運営者、他のユーザーまたは第三者の権利・利益を侵害する行為</li>
            <li>本サービスの運営を妨害し、またはサーバー・ネットワークに過度の負荷をかける行為（自動化された大量アクセス等を含みます）</li>
            <li>不正アクセス、リバースエンジニアリング、その他本サービスの安全性を損なう行為</li>
            <li>本サービスを通じて取得した情報を、権利者の許諾なく再配布・商用利用する行為</li>
            <li>その他、当運営者が不適切と合理的に判断する行為</li>
          </ol>
        </Article>

        <Article title="第6条（知的財産権）">
          <p>
            本サービスで表示される作品名、あらすじ、画像、放送・配信情報等の著作権その他の権利は、各作品の権利者または情報提供元（AniList等）に帰属します。本サービスは、これらの権利者による権利を侵害する目的で提供されるものではありません。
          </p>
          <p>権利者の方で掲載内容に懸念がある場合は、第11条のお問い合わせ先までご連絡ください。速やかに確認・対応します。</p>
        </Article>

        <Article title="第7条（広告の掲載）">
          <p>
            本サービスには、Google AdSense をはじめとする第三者配信事業者による広告が表示されることがあります。広告の取り扱い、Cookieの利用、パーソナライズ広告の停止方法については、別途定める
            <a href="/privacy" className="font-bold text-[#C2772A] underline">プライバシーポリシー</a>
            をご確認ください。
          </p>
        </Article>

        <Article title="第8条（サービスの変更・中断・終了）">
          <p>
            当運営者は、ユーザーへの事前の通知なく、本サービスの内容の全部または一部を変更・追加・中断・終了することができます。これによってユーザーに生じた損害について、当運営者は責任を負いません。
          </p>
        </Article>

        <Article title="第9条（免責事項）">
          <p>
            当運営者は、本サービスに事実上または法律上の瑕疵（安全性、正確性、確実性、有用性、特定目的への適合性、セキュリティ上の欠陥、エラーやバグ、権利侵害等を含みます）がないことを明示的にも黙示的にも保証しません。
          </p>
          <p>
            本サービスの利用に関連してユーザーに生じた損害について、当運営者に故意または重大な過失がある場合を除き、当運営者は責任を負いません。
          </p>
        </Article>

        <Article title="第10条（本規約の変更）">
          <p>
            当運営者は、必要と判断した場合、ユーザーへの個別の通知なく本規約を変更することができます。変更後の本規約は、本サービス上に掲載した時点から効力を生じます。変更後に本サービスを利用した場合、ユーザーは変更に同意したものとみなされます。
          </p>
        </Article>

        <Article title="第11条（準拠法・お問い合わせ）">
          <p>本規約の解釈および適用は、日本法に準拠します。本サービスに関して紛争が生じた場合、当運営者の所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。</p>
          <p>
            本規約または本サービスに関するお問い合わせは、次の連絡先までお願いします。<br />
            Animiru運営
            <a href="mailto:animemangapushtuchi@gmail.com" className="font-bold text-[#C2772A] underline">
              animemangapushtuchi@gmail.com
            </a>
          </p>
        </Article>
      </div>
    </main>
  );
}
