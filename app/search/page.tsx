"use client";

// 検索ページ。フリーワード＋種別/状態チップ＋#ジャンルタグ＋ソート。18禁除外。
// 何も入力していない＆「アニメ」選択時は、今期のアニメ一覧を表示（ソートで並び替え可）。
// 詳細のジャンルタップから /search?genre=◯◯ で来ると、そのジャンルが初期タグに入る。
// ・ページ式（前へ/次へ＋ページ番号）
// ・モジュールキャッシュで、ホーム/詳細へ遷移して戻っても再取得しない＋各ページとスクロール位置を保持
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
type PageData = { items: SeasonAnime[]; hasNext: boolean };
type CacheEntry = { pages: Record<number, PageData>; page: number; lastPage: number; scrollY: number };
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
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true); // 初回/条件変更の読み込み
  const [paging, setPaging] = useState(false); // ページ移動の読み込み
  const [searched, setSearched] = useState(false);

  const keyRef = useRef<string>("");
  const listTopRef = useRef<HTMLDivElement | null>(null);

  // URLの ?genre= を初期タグに（詳細のジャンルタップ導線）
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("genre");
    if (g) setTags([g]);
  }, []);

  // 条件変更でページ1を取得（キャッシュがあれば復元して再取得しない）
  useEffect(() => {
    lastParams = { q, filterKey, sortKey, tags };
    const key = makeKey(q, filterKey, sortKey, tags);
    keyRef.current = key;

    const cached = searchCache.get(key);
    if (cached && cached.pages[cached.page]) {
      const pd = cached.pages[cached.page];
      setItems(pd.items);
      setPage(cached.page);
      setLastPage(cached.lastPage);
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
        setLastPage(r.lastPage);
        searchCache.set(key, {
          pages: { 1: { items: r.items, hasNext: r.hasNextPage } },
          page: 1,
          lastPage: r.lastPage,
          scrollY: 0,
        });
        setLoading(false);
        setSearched(true);
      } catch {
        if (ctrl.signal.aborted) return;
        setItems([]);
        setLastPage(1);
        setLoading(false);
        setSearched(true);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, filterKey, sortKey, tags]);

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

  const scrollToTop = () =>
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  async function goToPage(n: number) {
    if (n < 1 || n > lastPage || n === page || loading || paging) return;
    const key = keyRef.current;
    const ent = searchCache.get(key);
    if (ent?.pages[n]) {
      setItems(ent.pages[n].items);
      setPage(n);
      ent.page = n;
      scrollToTop();
      return;
    }
    setPaging(true);
    try {
      const r = await searchMediaPage(buildOpts(q, filterKey, sortKey, tags), n);
      setItems(r.items);
      setPage(n);
      setLastPage(r.lastPage);
      if (ent) {
        ent.pages[n] = { items: r.items, hasNext: r.hasNextPage };
        ent.page = n;
        ent.lastPage = r.lastPage;
      }
      scrollToTop();
    } catch {
      /* noop */
    } finally {
      setPaging(false);
    }
  }

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));
  const noInput = q.trim().length === 0 && tags.length === 0;
  const isBrowse = noInput && filterKey === "anime";

  // 表示するページ番号（現在の前後2つ＋先頭/末尾）
  const windowNums: number[] = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(lastPage, page + 2); i++) windowNums.push(i);

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

      <div ref={listTopRef} className="mt-3 flex items-center justify-between scroll-mt-4">
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
          <ul
            className={`mt-3 divide-y divide-[#ECECF2] overflow-hidden rounded-2xl border border-[#ECECF2] bg-white transition-opacity ${
              paging ? "opacity-50" : ""
            }`}
          >
            {items.map((a) => (
              <li key={a.id}>
                <WorkRow {...a} />
              </li>
            ))}
          </ul>

          {lastPage > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || paging}
                className="rounded-lg border border-[#ECECF2] bg-white px-3 py-1.5 text-xs font-bold text-[#5B4FCF] disabled:opacity-40"
              >
                ← 前へ
              </button>

              {windowNums[0] > 1 && (
                <>
                  <button type="button" onClick={() => goToPage(1)} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#6B7280]">1</button>
                  {windowNums[0] > 2 && <span className="px-1 text-xs text-black/30">…</span>}
                </>
              )}

              {windowNums.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => goToPage(n)}
                  disabled={paging}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                    n === page ? "bg-[#5B4FCF] text-white" : "text-[#6B7280]"
                  }`}
                >
                  {n}
                </button>
              ))}

              {windowNums[windowNums.length - 1] < lastPage && (
                <>
                  {windowNums[windowNums.length - 1] < lastPage - 1 && (
                    <span className="px-1 text-xs text-black/30">…</span>
                  )}
                  <button type="button" onClick={() => goToPage(lastPage)} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#6B7280]">{lastPage}</button>
                </>
              )}

              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= lastPage || paging}
                className="rounded-lg border border-[#ECECF2] bg-white px-3 py-1.5 text-xs font-bold text-[#5B4FCF] disabled:opacity-40"
              >
                次へ →
              </button>
            </div>
          )}

          <p className="mt-2 text-center text-[11px] text-black/40">
            ページ {page} / {lastPage}
            {paging ? "　読み込み中…" : ""}
          </p>
        </>
      )}

      <p className="mt-6 text-[10px] text-black/40">出典：AniList</p>
    </main>
  );
}
