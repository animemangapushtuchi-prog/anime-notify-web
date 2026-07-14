"use client";

// 検索ページ。入力が止まって0.4秒後に検索し、古い応答は破棄（デバウンス＋abort）。18禁は除外。
import { useEffect, useState } from "react";
import Link from "next/link";
import { searchAnime, type SeasonAnime } from "@/lib/anilist";
import WorkCard from "@/components/WorkCard";

const TYPES = [
  { key: "ALL", label: "すべて", type: null },
  { key: "ANIME", label: "アニメ", type: "ANIME" },
  { key: "MANGA", label: "漫画", type: "MANGA" },
] as const;

type TypeKey = (typeof TYPES)[number]["key"];

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [typeKey, setTypeKey] = useState<TypeKey>("ALL");
  const [items, setItems] = useState<SeasonAnime[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setItems([]);
      setLoading(false);
      setSearched(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const type = TYPES.find((x) => x.key === typeKey)!.type;
        const r = await searchAnime(query, type, ctrl.signal);
        setItems(r);
        setLoading(false);
        setSearched(true);
      } catch {
        if (ctrl.signal.aborted) return; // 古い応答は破棄
        setItems([]);
        setLoading(false);
        setSearched(true);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, typeKey]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[#1C1C2E]">検索</h1>
        <Link href="/" className="text-sm font-semibold text-[#5B4FCF] hover:underline">
          ← 今期一覧へ
        </Link>
      </div>

      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="作品名を入力（例：呪術廻戦）"
        className="mt-4 w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#5B4FCF]"
        autoFocus
      />

      <div className="mt-3 flex gap-2">
        {TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTypeKey(t.key)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              typeKey === t.key
                ? "bg-[#5B4FCF] text-white"
                : "bg-[#ECEAFD] text-[#5B4FCF]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {loading && <p className="text-sm text-black/50">検索中…</p>}
        {!loading && searched && items.length === 0 && (
          <p className="text-sm text-black/50">
            見つかりませんでした。表記ゆれ（ひらがな/カタカナ/英語）を変えてみてください。
          </p>
        )}
        {items.length > 0 && (
          <section className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((a) => (
              <WorkCard key={a.id} {...a} />
            ))}
          </section>
        )}
      </div>

      <p className="mt-8 text-[10px] text-black/40">出典：AniList</p>
    </main>
  );
}
