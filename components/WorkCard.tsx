import Link from "next/link";

// 一覧の作品カード（カバー画像＋種別バッジ＋タイトル）。タップで詳細へ。
export default function WorkCard({
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
  return (
    <Link href={`/work/${id}`} className="group block">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-black/5">
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={title}
            className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
          />
        )}
        {status && (
          <span
            className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              status === "放送中" ? "bg-[#DC2626] text-white" : "bg-black/60 text-white"
            }`}
          >
            {status}
          </span>
        )}
      </div>
      <div className="mt-1.5">
        <span className="inline-block rounded bg-[#ECEAFD] px-1.5 py-0.5 text-[10px] font-bold text-[#5B4FCF]">
          {format}
        </span>
        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-[#1C1C2E]">
          {title}
        </p>
      </div>
    </Link>
  );
}
