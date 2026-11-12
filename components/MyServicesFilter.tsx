"use client";

// 今週のスケジュールを「自分が契約しているサービスで見られる作品だけ」に絞る。ログイン不要。
// 選んだサービスはこの端末のブラウザに覚えておくので、次に開いたときも絞られたままになる（サーバーには送らない）。
// 一覧そのものはサーバーで描いたまま。行に付けた data-svc を見て、合わない行を CSS で隠すだけ。
import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/track";
import ServiceIcon from "@/components/ServiceIcon";

const KEY = "myServices";

export default function MyServicesFilter({ services, target }: { services: { key: string; name: string }[]; target: string }) {
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
      const known = new Set(services.map((s) => s.key));
      const list = Array.isArray(saved) ? saved.filter((k) => typeof k === "string" && known.has(k)) : [];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 保存した選択はブラウザでしか読めない
      if (list.length) setPicked(list);
    } catch {
      /* 保存が読めなくても、絞り込みなしで表示する */
    }
  }, [services]);

  const update = (next: string[]) => {
    setPicked(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* noop */
    }
    if (next.length) trackEvent("filter");
  };
  const toggle = (key: string) => update(picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key]);

  // 選んだサービスのどれにも当てはまらない行と、作品数の表示（絞ると合わなくなる）を隠す
  const css = picked.length
    ? `#${target} li[data-svc]${picked.map((k) => `:not([data-svc~="${k}"])`).join("")}{display:none}#${target} [data-count],[data-count-for="${target}"]{display:none}`
    : "";

  return (
    <section aria-label="契約しているサービスで絞る" className="mt-5 rounded-2xl border border-line bg-white p-3">
      {css && <style>{css}</style>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-ink">
          契約しているサービスを選ぶと、見られる作品だけになります
          <span className="ml-1 font-normal text-ink-2">（この端末に保存）</span>
        </p>
        {picked.length > 0 && (
          <button type="button" onClick={() => update([])} className="rounded-full border border-line px-3 py-1 text-[11px] font-bold text-ink-2 transition hover:border-amber">
            絞り込みをやめる
          </button>
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {services.map((s) => {
          const on = picked.includes(s.key);
          return (
            <li key={s.key}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                  on ? "border-amber-deep bg-amber-wash text-ink" : "border-line bg-white text-ink-2 hover:border-amber"
                }`}
              >
                <ServiceIcon name={s.name} size={16} />
                {s.name}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
