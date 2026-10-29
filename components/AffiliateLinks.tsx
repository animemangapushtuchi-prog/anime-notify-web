// 配信サービスの紹介リンク（アフィリエイト）。content/ads.json に登録したサービスだけ出す。
// - 「PR」を必ず表示する（2023年10月からの景品表示法の告示＝いわゆるステマ規制のため）
// - 配信情報そのもの（どのサービスで見られるか）は紹介リンクの有無と関係なく、確認済みデータだけで決める
// - rel="sponsored"：検索エンジンに広告リンクであることを伝える
import { affiliateFor } from "@/lib/ads";
import { serviceNameOf } from "@/lib/streaming";

export default function AffiliateLinks({
  serviceKeys,
  className = "",
}: {
  serviceKeys: string[]; // この作品（またはこのページ）で確認済みのサービス
  className?: string;
}) {
  const links = [...new Set(serviceKeys)]
    .map((key) => ({ key, a: affiliateFor(key) }))
    .filter((x): x is { key: string; a: NonNullable<ReturnType<typeof affiliateFor>> } => x.a !== null);
  if (links.length === 0) return null;

  return (
    <aside aria-label="配信サービスの紹介（PR）" className={`rounded-2xl border border-line bg-white p-4 ${className}`}>
      <p className="flex items-center gap-2 text-xs font-bold text-ink">
        <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] text-white">PR</span>
        配信サービスに登録する
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {links.map(({ key, a }) => (
          <li key={key}>
            <a
              href={a.url}
              target="_blank"
              rel="sponsored noopener"
              className="inline-flex items-center gap-1 rounded-full bg-amber-deep px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
            >
              {a.text || `${serviceNameOf(key)}の公式サイトへ`} ↗
            </a>
            {a.pixel ? (
              // ASP の表示計測用（1x1）。画像として読み込むだけ
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.pixel} width={1} height={1} alt="" className="absolute h-px w-px opacity-0" />
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] leading-relaxed text-ink-2">
        このリンクから登録すると、アニミル！に紹介料が支払われることがあります。掲載している配信情報は、紹介料の有無に関係なく確認できたものだけです。
        料金・無料期間は変わることがあるため、登録前に各サービスの公式サイトでご確認ください。
      </p>
    </aside>
  );
}
