import Link from "next/link";
import type { LibraryWork } from "@/lib/library";
import ServiceIcon from "@/components/ServiceIcon";

// 人気アニメの配信早見表の一覧。サーバーだけで描くので、作品が多くてもブラウザの JS は増えない
export default function LibraryList({ works, highlight }: { works: LibraryWork[]; highlight?: string }) {
  return (
    <ol className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {works.map((w, i) => (
        <li key={w.id} className="relative flex items-center gap-3 rounded-2xl border border-line bg-white p-2 transition hover:border-amber">
          <span className="num w-7 flex-none text-right text-[11px] font-bold text-ink-2">{i + 1}</span>
          <div className="h-[60px] w-[42px] flex-none overflow-hidden rounded-lg bg-paper-2 ring-1 ring-black/5">
            {w.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={w.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <Link href={`/work/${w.id}`} className="line-clamp-2 text-[13px] font-bold leading-snug text-ink after:absolute after:inset-0 hover:text-amber-ink">
              {w.title}
            </Link>
            <ul className="mt-1 flex flex-wrap gap-1" aria-label="配信サービス">
              {w.services.map((s) => (
                <li key={s.key} className={highlight && s.key !== highlight ? "opacity-40" : ""} title={s.name}>
                  <ServiceIcon name={s.name} size={18} />
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ol>
  );
}
