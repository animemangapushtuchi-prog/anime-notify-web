import Link from "next/link";

// 節の見出し。小さな欧文の見出し（eyebrow）＋大きな日本語の見出し＋右側の「もっと見る」。
export default function SectionHead({
  eyebrow,
  title,
  desc,
  href,
  linkLabel,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  href?: string;
  linkLabel?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="num flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-ink">
            <span aria-hidden="true" className="h-px w-6 bg-amber" />
            {eyebrow}
          </p>
        )}
        <Tag className="mt-2 text-[26px] font-black leading-tight text-ink lg:text-[34px]">{title}</Tag>
        {desc && <p className="mt-2 max-w-[42em] text-sm leading-relaxed text-ink-2">{desc}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex flex-none items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-xs font-bold text-amber-ink transition hover:border-amber hover:bg-amber-wash"
        >
          {linkLabel ?? "もっと見る"}
          <span aria-hidden="true" className="transition group-hover:translate-x-0.5">→</span>
        </Link>
      )}
    </div>
  );
}
