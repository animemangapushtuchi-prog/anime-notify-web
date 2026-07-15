"use client";

// 検索ページ。作品/スタジオ/人物（声優・スタッフ）を横断。
// ・入力中サジェスト（ドロップダウン）：作品→詳細へ、スタジオ/人物→その作品一覧へ
// ・ページ式（前へ/次へ＋ページ番号）
// ・セッション内キャッシュ：遷移して戻っても再取得せず、開いていたページ/スクロール位置を復元
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  searchMediaPage,
  studioWorksPage,
  personWorksPage,
  suggestSearch,
  genreJa,
  type SeasonAnime,
  type Suggestion,
} from "@/lib/anilist";
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

type Target = { kind: "studio" | "person"; id: number; name: string } | null;
type PageData = { items: SeasonAnime[]; hasNext: boolean };
type CacheEntry = { pages: Record<number, PageData>; page: number; lastPage: number; scrollY: number };

const searchCache = new Map<string, CacheEntry>();
let lastState: { q: string; filterKey: string; sortKey: string; tags: string[]; target: Target } | null = null;
const makeKey = (t: Target, q: string, fk: string, sk: string, tags: string[]) =>
  JSON.stringify({ t: t ? `${t.kind}:${t.id}` : 0, q: q.trim(), fk, sk, tags: [...tags].sort() });

function buildOpts(q: string, filterKey: string, sortKey: string, tags: string[]) {
  const f = FILTERS.find((x) => x.key === filterKey)!;
  const noInput = q.trim().length === 0 && tags.length === 0;
  const useSeason = f.season || (noInput && filterKey === "anime");
  return { search: q.trim(), type: f.type, status: f.status, genres: tags, sort: sortKey, season: useSeason };
}

export default function SearchPage() {
  const router = useRouter();
  const [q, setQ] = useState(() => lastState?.q ?? "");
  const [filterKey, setFilterKey] = useState<string>(() => lastState?.filterKey ?? "anime");
  const [sortKey, setSortKey] = useState<string>(() => lastState?.sortKey ?? "match");
  const [tags, setTags] = useState<string[]>(() => lastState?.tags ?? []);
  const [target, setTarget] = useState<Target>(() => lastState?.target ?? null);

  const [items, setItems] = useState<SeasonAnime[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [searched, setSearched] = useState(false);

  const [sug, setSug] = useState<Suggestion[]>([]);
  const [sugOpen, setSugOpen] = useState(false);

  const keyRef = useRef<string>("");
  const listTopRef = useRef<HTMLDivElement | null>(null);

  // URLの ?genre= を初期タグに（詳細のジャンルタップ導線）
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("genre");
    if (g) {
      setTarget(null);
      setTags([g]);
    }
  }, []);

  const fetchPage = (pg: number, signal?: AbortSignal) => {
    if (target?.kind === "studio") return studioWorksPage(target.id, pg, signal);
    if (target?.kind === "person") return personWorksPage(target.id, pg, signal);
    return searchMediaPage(buildOpts(q, filterKey, sortKey, tags), pg, signal);
  };

  // 条件/対象の変更でページ1を取得（キャッシュがあれば復元して再取得しない）
  useEffect(() => {
    lastState = { q, filterKey, sortKey, tags, target };
    const key = makeKey(target, q, filterKey, sortKey, tags);
    keyRef.current = key;

    const cached = searchCache.get(key);
    if (cached && cached.pages[cached.page]) {
      setItems(cached.pages[cached.page].items);
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
        const r = await fetchPage(1, ctrl.signal);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filterKey, sortKey, tags, target]);

  // 入力補完（サジェスト）
  useEffect(() => {
    if (!q.trim()) {
      setSug([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        setSug(await suggestSearch(q, ctrl.signal));
      } catch {
        /* noop */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  // スクロール位置をキャッシュに保存
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

  const scrollToTop = () => listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

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
      const r = await fetchPage(n);
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

  function pickSuggestion(s: Suggestion) {
    setSugOpen(false);
    if (s.kind === "work") {
      router.push(`/work/${s.id}`);
      return;
    }
    setTarget({ kind: s.kind, id: s.id, name: s.label });
    setQ("");
    setTags([]);
    setSug([]);
  }

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));
  const noInput = q.trim().length === 0 && tags.length === 0;
  const isBrowse = !target && noInput && filterKey === "anime";

  const windowNums: number[] = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(lastPage, page + 2); i++) windowNums.push(i);

  const kindMark = (k: Suggestion["kind"]) => (k === "studio" ? "🎬" : k === "person" ? "🎤" : "");

  return (
    <main className="mx-auto max-w-2xl px-4 py-5">
      <h1 className="text-xl font-extrabold text-[#1C1C2E]">検索</h1>

      {/* 入力＋サジェスト */}
      <div className="relative mt-3">
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (target) setTarget(null);
            setSugOpen(true);
          }}
          onFocus={() => setSugOpen(true)}
          onBlur={() => setTimeout(() => setSugOpen(false), 150)}
          placeholder="作品名・スタジオ・声優/スタッフ名で検索"
          className="w-full rounded-xl border border-[#ECECF2] bg-white px-4 py-3 text-sm outline-none focus:border-[#5B4FCF]"
        />
        {sugOpen && sug.length > 0 && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-[#ECECF2] bg-white shadow-xl">
            {sug.map((s) => (
              <button
                key={`${s.kind}-${s.id}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickSuggestion(s);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#F6F5FF]"
              >
                {s.kind === "work" && s.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.cover} alt="" className="h-10 w-7 flex-none rounded object-cover" />
                ) : (
                  <span className="flex h-10 w-7 flex-none items-center justify-center rounded bg-[#ECEAFD] text-sm">
                    {kindMark(s.kind)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-[#1C1C2E]">{s.label}</span>
                  <span className="block text-[10px] text-[#6B7280]">
                    {s.kind === "studio" ? "スタジオ" : s.kind === "person" ? `${s.sub}` : s.sub}
                  </span>
                </span>
                <span className="flex-none text-black/25">›</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 対象（スタジオ/人物）バナー or 種別チップ */}
      {target ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-full bg-[#F1E9FE] px-3 py-1 text-xs font-bold text-[#7C3AED]">
            {target.kind === "studio" ? "🎬" : "🎤"} {target.name} の作品
          </span>
          <button
            type="button"
            onClick={() => setTarget(null)}
            className="rounded-full border border-[#ECECF2] bg-white px-2 py-1 text-[11px] font-bold text-[#6B7280]"
          >
            解除 ×
          </button>
        </div>
      ) : (
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
      )}

      {!target && tags.length > 0 && (
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
        <h2 className="text-xs font-bold text-[#5B4FCF]">
          {target ? `${target.name} の作品` : isBrowse ? "🌐 今期のアニメ" : "検索結果"}
        </h2>
        {!target && (
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
        )}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-black/50">読み込み中…</p>
      ) : items.length === 0 && searched ? (
        <p className="mt-4 text-sm text-black/50">見つかりませんでした。条件を変えてみてください。</p>
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
