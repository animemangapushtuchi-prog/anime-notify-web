import Link from "next/link";

// 一覧の作品カード（カバー画像＋種別＋タイトル）。タップで詳細へ。
// rank を渡すと、表紙の左下に順位を大きく重ねる（トップの「今期の注目」用）。
export default function WorkCard({
  id,
  title,
  coverUrl,
  format,
  status,
  rank,
}: {
  id: number;
  title: string;
  coverUrl: string;
  format: string;
  status?: string;
  rank?: number;
}) {
  return (
    <Link href={`/work/${id}`} className="group block rounded-2xl">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-paper-2 shadow-[0_1px_0_rgba(26,21,35,0.04)] ring-1 ring-black/5 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_-18px_rgba(26,21,35,0.55)]">
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        )}
        {status && (
          <span
            className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur ${
              status === "放送中" ? "bg-[#C0392B]/90 text-white" : "bg-black/55 text-white"
            }`}
          >
            {status === "放送中" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
            {status}
          </span>
        )}
        {rank != null && (
          <>
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
            <span className="num absolute bottom-1 left-2.5 text-[34px] font-black italic leading-none text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
              <span className="sr-only">人気</span>
              {rank}
              <span className="sr-only">位</span>
            </span>
          </>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <span className="text-[10px] font-bold tracking-wide text-amber-ink">{format}</span>
        <p className="mt-0.5 line-clamp-2 text-[13px] font-bold leading-snug text-ink group-hover:text-amber-ink">
          {title}
        </p>
      </div>
    </Link>
  );
}
