import Link from "next/link";
import type { ReactNode } from "react";

// 各ページ上部の見出し。パンくず・小さな欧文見出し・大きな日本語の h1・説明・右側の補足。
export default function PageHeader({
  crumbs = [],
  eyebrow,
  title,
  desc,
  aside,
  children,
}: {
  crumbs?: { href?: string; label: string }[];
  eyebrow?: string;
  title: ReactNode;
  desc?: ReactNode;
  aside?: ReactNode; // 右側（PC）／下（スマホ）に置く補足
  children?: ReactNode; // 見出しの下に続ける要素
}) {
  return (
    <header className="pt-4 lg:pt-6">
      {crumbs.length > 0 && (
        <nav aria-label="パンくずリスト" className="text-[11px] text-ink-2">
          <ol className="flex flex-wrap items-center gap-1">
            {crumbs.map((c, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden="true" className="text-ink-2/60">/</span>}
                {c.href ? (
                  <Link href={c.href} className="transition hover:text-amber-ink">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-ink">{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && (
            <p className="num flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-ink">
              <span aria-hidden="true" className="h-px w-6 bg-amber" />
              {eyebrow}
            </p>
          )}
          <h1 className="mt-2 text-[28px] font-black leading-[1.25] text-ink lg:text-[40px]">{title}</h1>
          {desc && <div className="mt-3 text-sm leading-relaxed text-ink-2">{desc}</div>}
        </div>
        {aside}
      </div>
      {children}
    </header>
  );
}
