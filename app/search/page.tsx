"use client";

// 検索ページ。フリーワード＋種別/状態チップ＋#ジャンルタグ＋ソート。18禁除外。
// 何も入力していない＆「アニメ」選択時は、今期のアニメ一覧を表示（ソートで並び替え可）。
// 詳細のジャンルタップから /search?genre=◯◯ で来ると、そのジャンルが初期タグに入る。
// ・無限スクロール（下端で次ページを追記）
// ・モジュールキャッシュで、ホーム/詳細へ遷移して戻っても再取得しない＋スクロール位置も復元
import { useEffect, useRef, useState } from "react";
import { searchMediaPage, genreJa, type SeasonAnime } from "@/lib/anilist";
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

// ---- セッション内キャッシュ（ページ遷移で消えない。フルリロードでのみクリア） ----
type CacheEntry = { items: SeasonAnime[]; page: number; hasNext: boolean; scrollY: number };
const searchCache = new Map<string, CacheEntry>();
let lastParams: { q: string; filterKey: string; sortKey: string; tags: string[] } | null = null;
const makeKey = (q: string, fk: string, sk: string, tags: string[]) =>
  JSON.stringify({ q: q.trim(), fk, sk, tags: [...tags].sort() });

function buildOpts(q: string, filterKey: string, sortKey: string, tags: string[]) {
  const f = FILTERS.find((x) => x.key === filterKey)!;
  const noInput = q.trim().length === 0 && tags.length === 0;
  const useSeason = f.season || (noInput && filterKey === "anime");
  return { search: q.trim(), type: f.type, status: f.status, genres: tags, sort: sortKey, season: useSeason };
}

export default function SearchPage() {
  const [q, setQ] = useState(() => lastParams?.q ?? "");
  const [filterKey, setFilterKey] = useState<string>(() => lastParams?.filterKey ?? "anime");
  const [sortKey, setSortKey] = useState<string>(() => lastParams?.sortKey ?? "match");
  const [tags, setTags] = useState<string[]>(() => lastParams?.tags ?? []);
  const [items, setItems] = useState<SeasonAnime[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);

  const keyRef = useRef<string>("");
  const loadingMoreRef = useRef(false);
  const loadMoreRef = useRef<() => void>(() => {});
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // URLの ?genre= を初期タグに（詳細のジャンルタップ導線）
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("genre");
    if (g) setTags([g]);
  }, []);

  // メイン検索（パラメータ変化で1ページ目を取得。ただしキャッシュがあれば復元して再取得しない）
  useEffect(() => {
    lastParams = { q, filterKey, sortKey, tags };
    const key = makeKey(q, filterKey, sortKey, tags);
    keyRef.current = key;

    const cached = searchCache.get(key);
    if (cached) {
      setItems(cached.items);
      setPage(cached.page);
      setHasNext(cached.hasNext);
      setLoading(false);
      setSearched(true);
      const y = cached.scrollY;
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
      return;
    }

    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await searchMediaPage(buildOpts(q, filterKey, sortKey, tags), 1, ctrl.signal);
        setItems(r.items);
        setPage(1);
        setHasNext(r.hasNextPage);
        searchCache.set(key, { items: r.items, page: 1, hasNext: r.hasNextPage, scrollY: 0 });
        setLoading(false);
        setSearched(true);
      } catch {
        if (ctrl.signal.aborted) return;
        setItems([]);
        setHasNext(false);
        setLoading(false);
        setSearched(true);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, filterKey, sortKey, tags]);

  // 次ページ追記（無限スクロール）。毎レンダーで最新stateを閉じ込めた関数をrefに載せる。
  loadMoreRef.current = async () => {
    if (loadingMoreRef.current || loading || !hasNext) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const next = page + 1;
    try {
      const r = await searchMediaPage(buildOpts(q, filterKey, sortKey, tags), next);
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev, ...r.items.filter((x) => !seen.has(x.id))];
        const ent = searchCache.get(keyRef.current);
        if (ent) {
          ent.items = merged;
          ent.page = next;
          ent.hasNext = r.hasNextPage;
        }
        return merged;
      });
      setPage(next);
      setHasNext(r.hasNextPage);
    } catch {
      /* 失敗時は次回スクロールで再試行 */
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  // 下端センチネルを監視して追記
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreRef.current();
      },
      { rootMargin: "600px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // スクロール位置をキャッシュに保存（遷移して戻ったとき復元するため）
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const ent = searchCache.get(keyRef.current);
        if (ent) ent.scrollY = window.scrollY;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
        placeholder="作品名を入力"
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
        <h2 className="text-xs font-bold text-[#5B4FCF]">{isBrowse ? "🌐 今期のアニメ" : "検索結果"}</h2>
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
        <>
          <ul className="mt-3 divide-y divide-[#ECECF2] overflow-hidden rounded-2xl border border-[#ECECF2] bg-white">
            {items.map((a) => (
              <li key={a.id}>
                <WorkRow {...a} />
              </li>
            ))}
          </ul>

          {/* 無限スクロール用センチネル＋状態表示 */}
          <div ref={sentinelRef} className="h-8" />
          {loadingMore && <p className="mt-2 text-center text-xs text-black/40">読み込み中…</p>}
          {!hasNext && items.length > 0 && (
            <p className="mt-2 text-center text-[11px] text-black/30">これ以上はありません</p>
          )}
        </>
      )}

      <p className="mt-6 text-[10px] text-black/40">出典：AniList</p>
    </main>
  );
}
