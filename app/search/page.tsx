"use client";

// 検索ページ。フリーワード＋種別/状態チップ＋#ジャンルタグ＋ソート。18禁除外。
// 何も入力していない＆「アニメ」選択時は、今期のアニメ一覧を表示（ソートで並び替え可）。
// 詳細のジャンルタップから /search?genre=◯◯ で来ると、そのジャンルが初期タグに入る。
import { useEffect, useState } from "react";
import { searchMedia, genreJa, type SeasonAnime } from "@/lib/anilist";
import WorkRow from "@/components/WorkRow";

const FILTERS = [
  { key: "anime", label: "アニメ", type: "ANIME", status: null, season: false },
  { key: "manga", label: "漫画", type: "MANGA", status: null, season: false },
  { key: "airing", label: "今期放送中", type: "ANIME", status: "RELEASING", season: true },
  { key: "finished", label: "配信済", type: "ANIME", status: "FINISHED", season: false },
  { key: "unreleased", label: "未発表", type: "ANIME", status: "NOT_YET_RELEASED", season: false },
] as const;

const SORTS = [
  { key: "match", label: "関連順" },
  { key: "trending", label: "急上昇" },
  { key: "popular", label: "人気" },
  { key: "score", label: "評価順" },
  { key: "new", label: "新しい順" },
] as const;

function List({ items }: { items: SeasonAnime[] }) {
  return (
    <ul className="mt-3 divide-y divide-[#ECECF2] overflow-hidden rounded-2xl border border-[#ECECF2] bg-white">
      {items.map((a) => (
        <li key={a.id}>
          <WorkRow {...a} />
        </li>
      ))}
    </ul>
  );
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [filterKey, setFilterKey] = useState<string>("anime");
  const [sortKey, setSortKey] = useState<string>("match");
  const [tags, setTags] = useState<string[]>([]);
  const [items, setItems] = useState<SeasonAnime[]>([]);
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);

  // URLの ?genre= を初期タグに（詳細のジャンルタップ導線）
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("genre");
    if (g) setTags([g]);
  }, []);

  useEffect(() => {
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const f = FILTERS.find((x) => x.key === filterKey)!;
        const noInput = q.trim().length === 0 && tags.length === 0;
        const useSeason = f.season || (noInput && filterKey === "anime");
        const r = await searchMedia(
          {
            search: q.trim(),
            type: f.type,
            status: f.status,
            genres: tags,
            sort: sortKey,
            season: useSeason,
          },
          ctrl.signal
        );
        setItems(r);
        setLoading(false);
        setSearched(true);
      } catch {
        if (ctrl.signal.aborted) return;
        setItems([]);
        setLoading(false);
        setSearched(true);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, filterKey, sortKey, tags]);

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const noInput = q.trim().length === 0 && tags.length === 0;
  const isBrowse = noInput && filterKey === "anime";

  return (
    <main className="mx-auto max-w-2xl px-4 py-5">
      <h1 className="text-xl font-extrabold text-[#1C1C2E]">検索</h1>

      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="作品名を入力（入力中に候補が出ます）"
        className="mt-3 w-full rounded-xl border border-[#ECECF2] bg-white px-4 py-3 text-sm outline-none focus:border-[#5B4FCF]"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilterKey(t.key)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              filterKey === t.key ? "bg-[#5B4FCF] text-white" : "bg-[#ECEAFD] text-[#5B4FCF]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => removeTag(t)}
              className="flex items-center gap-1 rounded-full bg-[#F1E9FE] px-3 py-1 text-xs font-bold text-[#7C3AED]"
            >
              #{genreJa(t)} <span className="text-[10px]">×</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <h2 className="text-xs font-bold text-[#5B4FCF]">
          {isBrowse ? "🌐 今期のアニメ" : "検索結果"}
        </h2>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          className="rounded-full border border-[#ECECF2] bg-white px-2 py-1 text-xs font-bold text-[#1C1C2E]"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-black/50">読み込み中…</p>
      ) : items.length === 0 && searched ? (
        <p className="mt-4 text-sm text-black/50">
          見つかりませんでした。条件を変えてみてください（表記ゆれ・タグ・チップ）。
        </p>
      ) : (
        <List items={items} />
      )}

      <p className="mt-6 text-[10px] text-black/40">出典：AniList</p>
    </main>
  );
}
