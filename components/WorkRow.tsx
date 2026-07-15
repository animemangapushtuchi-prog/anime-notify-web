import Link from "next/link";

// 検索・一覧のリスト行（カバー＋タイトル＋種別バッジ＋状態）。Flutter版の検索行に相当。
export default function WorkRow({
  id,
  title,
  coverUrl,
  format,
  status,
}: {
  id: number;
  title: string;
  coverUrl: string;
  format: string;
  status?: string;
}) {
  const airing = status === "放送中";
  return (
    <Link href={`/work/${id}`} className="flex items-center gap-3 px-3 py-3">
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt={title} className="h-16 w-11 flex-none rounded-md object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-bold text-[#1C1C2E]">{title}</span>
          {format && (
            <span className="rounded-full bg-[#ECEAFD] px-2 py-0.5 text-[10px] font-bold text-[#5B4FCF]">
              {format}
            </span>
          )}
          {status && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                airing ? "bg-[#FDEAEA] text-[#DC2626]" : "bg-black/5 text-black/50"
              }`}
            >
              {status}
            </span>
          )}
        </div>
      </div>
      <span className="flex-none text-black/30">›</span>
    </Link>
  );
}
