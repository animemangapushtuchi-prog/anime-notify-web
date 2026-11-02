"use client";

// 見たい作品を選ぶと、いちばん安い配信サービスの組み合わせを計算する。
// 選んだ作品はアドレスの ?w= に入れるので、そのまま人に送れる（ログイン不要・どこにも保存しない）
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cheapestPlan, type PlanWork, type Prices } from "@/lib/planner";
import { serviceNameOf } from "@/lib/streaming";
import ServiceIcon from "@/components/ServiceIcon";

export default function Planner({ works, prices }: { works: PlanWork[]; prices: Prices }) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);

  // 共有されたアドレスから選択を復元する
  useEffect(() => {
    const ids = new URLSearchParams(location.search).get("w")?.split(",").map(Number).filter(Number.isFinite) ?? [];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- アドレスはブラウザでしか読めない
    if (ids.length) setPicked(new Set(ids.filter((id) => works.some((w) => w.id === id))));
  }, [works]);

  useEffect(() => {
    const url = new URL(location.href);
    if (picked.size) url.searchParams.set("w", [...picked].join(","));
    else url.searchParams.delete("w");
    history.replaceState(null, "", url);
  }, [picked]);

  const selected = useMemo(() => works.filter((w) => picked.has(w.id)), [works, picked]);
  const result = useMemo(() => cheapestPlan(selected, prices), [selected, prices]);
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return k ? works.filter((w) => w.title.toLowerCase().includes(k)) : works;
  }, [works, q]);

  const toggle = (id: number) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const copy = async () => {
    await navigator.clipboard.writeText(location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
      <section aria-label="作品を選ぶ" className="min-w-0">
        <div className="sticky top-0 z-10 -mx-4 bg-paper/95 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="作品名でしぼる"
              aria-label="作品名でしぼる"
              className="min-w-0 flex-1 rounded-full border border-line bg-white px-4 py-2 text-sm text-ink outline-none focus:border-amber"
            />
            {picked.size > 0 && (
              <button type="button" onClick={() => setPicked(new Set())} className="flex-none rounded-full border border-line bg-white px-3 py-2 text-xs font-bold text-ink-2 transition hover:border-amber">
                解除
              </button>
            )}
          </div>
          {/* スマホでは一覧を見ながら金額が分かるように、ここに小さく出す */}
          <a href="#plan-result" className="mt-2 flex items-center justify-between rounded-2xl bg-ink px-4 py-2 text-sm font-bold text-white lg:hidden">
            <span>{picked.size}作品を選択中</span>
            <span className="num">月額 {result.total.toLocaleString()}円 ›</span>
          </a>
        </div>

        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {shown.map((w) => {
            const on = picked.has(w.id);
            return (
              <li key={w.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(w.id)}
                  className={`group relative block w-full overflow-hidden rounded-xl bg-white text-left ring-2 transition ${on ? "ring-amber" : "ring-transparent hover:ring-line"}`}
                >
                  <span className="relative block aspect-[2/3] bg-paper-2">
                    {w.cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.cover} alt="" loading="lazy" className={`h-full w-full object-cover transition ${on ? "" : "group-hover:scale-105"}`} />
                    )}
                    {on && (
                      <span aria-hidden="true" className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-deep text-xs font-black text-white">✓</span>
                    )}
                  </span>
                  <span className="line-clamp-2 block px-1.5 py-1 text-[11px] font-bold leading-snug text-ink">{w.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {shown.length === 0 && <p className="mt-6 text-center text-sm text-ink-2">一致する作品がありません。</p>}
      </section>

      <aside id="plan-result" className="mt-6 scroll-mt-4 rounded-3xl border border-line bg-white p-5 lg:sticky lg:top-6 lg:mt-0">
        <h2 className="text-[15px] font-black text-ink">いちばん安い組み合わせ</h2>
        {picked.size === 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-2">見たい作品を選ぶと、ここに必要なサービスと月額の合計が出ます。</p>
        ) : (
          <>
            <p className="mt-2 text-ink">
              <span className="text-xs font-bold text-ink-2">月額の合計 </span>
              <span className="num text-3xl font-black">{result.total.toLocaleString()}</span>
              <span className="text-sm font-bold">円</span>
            </p>
            <p className="text-xs text-ink-2">{picked.size}作品のうち{result.covered}作品が見られます</p>

            <ul className="mt-3 space-y-3">
              {result.services.map((key) => {
                const list = selected.filter((w) => w.services.includes(key));
                return (
                  <li key={key} className="flex gap-2.5">
                    <ServiceIcon name={serviceNameOf(key)} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline justify-between gap-2 text-sm font-bold text-ink">
                        <span>{serviceNameOf(key)}</span>
                        <span className="num flex-none text-xs">{prices[key].toLocaleString()}円</span>
                      </p>
                      <p className="line-clamp-2 text-[11px] leading-snug text-ink-2">{list.map((w) => w.title).join("、")}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            {result.missing.length > 0 && (
              <div className="mt-3 rounded-2xl bg-amber-wash px-3 py-2 text-[11px] leading-relaxed text-ink">
                <p className="font-bold">計算に入らなかった作品</p>
                {result.missing.map((w) => (
                  <p key={w.id}><Link href={`/work/${w.id}`} className="underline underline-offset-2">{w.title}</Link></p>
                ))}
                <p className="mt-1 text-ink-2">月額料金を確認できたサービスで配信が確認できていません。</p>
              </div>
            )}

            <button type="button" onClick={copy} className="mt-4 w-full rounded-full border border-line px-4 py-2 text-xs font-bold text-amber-ink transition hover:border-amber">
              {copied ? "コピーしました" : "この結果のアドレスをコピー"}
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
