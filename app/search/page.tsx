"use client";

// 検索ページ。モード式：今期放送中(既定)/アニメ(全期間)/漫画/映画/来期放送/スタジオ/声優。
// ・入力中サジェストは選択中モードのカテゴリだけに限定（作品 or スタジオ or 声優・スタッフ）。
// ・ページ送りは hasNext ベース（AniListの総ページ数は成人向け除外等で過大に出るため信用しない）。
//   万一空ページに当たっても直前の有効ページへ戻る（操作不能を防止）。
// ・セッション内キャッシュ：遷移復帰でも再取得せず位置復元。
// ・詳細ページの声優クリック → /search?person=名前 で自動表示。
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  searchMediaPage,
  studioWorksPage,
  personWorksPage,
  suggestWorks,
  suggestStudios,
  suggestStaff,
  genreJa,
  type SeasonAnime,
  type Suggestion,
} from "@/lib/anilist";
import WorkRow from "@/components/WorkRow";

type Season = "current" | "next" | false;
type Mode = {
  key: string;
  label: string;
  kind: "media" | "studio" | "voice";
  type?: "ANIME" | "MANGA" | null;
  status?: string | null;
  season?: Season;
  format?: string | null;
};
const MODES: Mode[] = [
  { key: "airing", label: "今期放送中", kind: "media", type: "ANIME", status: "RELEASING", season: "current", format: null },
  { key: "anime", label: "アニメ", kind: "media", type: "ANIME", status: null, season: false, format: null },
  { key: "manga", label: "漫画", kind: "media", type: "MANGA", status: null, season: false, format: null },
  { key: "movie", label: "映画", kind: "media", type: "ANIME", status: null, season: false, format: "MOVIE" },
  { key: "next", label: "来期放送", kind: "media", type: "ANIME", status: null, season: "next", format: null },
  { key: "studio", label: "スタジオ", kind: "studio" },
  { key: "voice", label: "声優", kind: "voice" },
];

const SORTS = [
  { key: "match", label: "関連順" },
  { key: "trending", label: "急上昇" },
  { key: "popular", label: "人気" },
  { key: "score", label: "評価順" },
  { key: "new", label: "新しい順" },
] as const;

type Target = { kind: "studio" | "person"; id: number; name: string } | null;
type PageData = { items: SeasonAnime[]; hasNext: boolean };
type CacheEntry = { pages: Record<number, PageData>; page: number; scrollY: number };

const searchCache = new Map<string, CacheEntry>();
let lastState: { q: string; mode: string; sortKey: string; tags: string[]; target: Target } | null = null;

const makeKey = (mode: string, target: Target, q: string, sk: string, tags: string[]) =>
  target
    ? JSON.stringify({ t: `${target.kind}:${target.id}` })
    : JSON.stringify({ mode, q: q.trim(), sk, tags: [...tags].sort() });

export default function SearchPage() {
  const router = useRouter();
  const [q, setQ] = useState(() => lastState?.q ?? "");
  const [mode, setMode] = useState<string>(() => lastState?.mode ?? "airing");
  const [sortKey, setSortKey] = useState<string>(() => lastState?.sortKey ?? "popular");
  const [tags, setTags] = useState<string[]>(() => lastState?.tags ?? []);
  const [target, setTarget] = useState<Target>(() => lastState?.target ?? null);

  const [items, setItems] = useState<SeasonAnime[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [searched, setSearched] = useState(false);

  const [sug, setSug] = useState<Suggestion[]>([]);
  const [sugOpen, setSugOpen] = useState(false);

  const keyRef = useRef<string>("");
  const listTopRef = useRef<HTMLDivElement | null>(null);

  const cur = MODES.find((x) => x.key === mode)!;
  const entity = cur.kind !== "media";

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const g = sp.get("genre");
    const person = sp.get("person") || sp.get("voice");
    if (g) {
      setTarget(null);
      setMode("anime");
      setTags([g]);
      return;
    }
    if (person) {
      setMode("voice");
      setQ(person);
      (async () => {
        try {
          const r = await suggestStaff(person);
          if (r[0]) setTarget({ kind: "person", id: r[0].id, name: r[0].label });
        } catch {
          /* noop */
        }
      })();
    }
  }, []);

  const fetchPage = (pg: number, signal?: AbortSignal) => {
    if (target?.kind === "studio") return studioWorksPage(target.id, pg, signal);
    if (target?.kind === "person") return personWorksPage(target.id, pg, signal);
    return searchMediaPage(
      { search: q.trim(), type: cur.type ?? null, status: cur.status ?? null, genres: tags, sort: sortKey, season: cur.season, format: cur.format },
      pg,
      signal
    );
  };

  useEffect(() => {
    lastState = { q, mode, sortKey, tags, target };
    if (entity && !target) {
      setItems([]);
      setLoading(false);
      setSearched(false);
      setPage(1);
      setHasNext(false);
      keyRef.current = "";
      return;
    }
    const key = makeKey(mode, target, q, sortKey, tags);
    keyRef.current = key;

    const cached = searchCache.get(key);
    if (cached && cached.pages[cached.page]) {
      setItems(cached.pages[cached.page].items);
      setPage(cached.page);
      setHasNext(cached.pages[cached.page].hasNext);
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
        setHasNext(r.hasNextPage);
        searchCache.set(key, { pages: { 1: { items: r.items, hasNext: r.hasNextPage } }, page: 1, scrollY: 0 });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, mode, sortKey, tags, target]);

  useEffect(() => {
    if (!q.trim()) {
      setSug([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const fn = cur.kind === "studio" ? suggestStudios : cur.kind === "voice" ? suggestStaff : suggestWorks;
        setSug(await fn(q, ctrl.signal));
      } catch {
        /* noop */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, mode]);

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
    if (n < 1 || n === page || loading || paging) return;
    const ent = searchCache.get(keyRef.current);
    if (ent?.pages[n]) {
      setItems(ent.pages[n].items);
      setPage(n);
      setHasNext(ent.pages[n].hasNext);
      if (ent) ent.page = n;
      scrollToTop();
      return;
    }
    setPaging(true);
    try {
      const r = await fetchPage(n);
      if (r.items.length === 0 && n > 1) {
        // 実データの終端（AniListのhasNext誤り／成人向け除外で空）。今のページに留まり次を無効化。
        setHasNext(false);
        if (ent && ent.pages[page]) ent.pages[page].hasNext = false;
        return;
      }
      setItems(r.items);
      setPage(n);
      setHasNext(r.hasNextPage);
      if (ent) {
        ent.pages[n] = { items: r.items, hasNext: r.hasNextPage };
        ent.page = n;
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
    setSug([]);
  }

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  // ページ番号（hasNextベース。lastPageは信用しない）
  const lo = Math.max(1, page - 2);
  const hi = hasNext ? page + 1 : page;
  const windowNums: number[] = [];
  for (let i = lo; i <= hi; i++) windowNums.push(i);

  const header = target
    ? `${target.name} の作品`
    : q.trim() && cur.kind === "media"
      ? "検索結果"
      : cur.label;

  return (
    <main className="mx-auto max-w-2xl px-4 py-5">
      <h1 className="text-xl font-extrabold text-[#1C1C2E]">検索</h1>

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
          placeholder={
            cur.kind === "studio"
              ? "制作会社名（例：MAPPA / 京アニ / ジブリ）"
              : cur.kind === "voice"
                ? "声優・スタッフ名（例：宮野真守）"
                : "作品名で検索"
          }
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
                    {s.kind === "studio" ? "🎬" : s.kind === "person" ? "🎤" : "▶"}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-[#1C1C2E]">{s.label}</span>
                  <span className="block text-[10px] text-[#6B7280]">{s.sub}</span>
                </span>
                <span className="flex-none text-black/25">›</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => {
              setMode(m.key);
              setTarget(null);
            }}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${mode === m.key ? "bg-[#5B4FCF] text-white" : "bg-[#ECEAFD] text-[#5B4FCF]"}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {target && (
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-[#F1E9FE] px-3 py-1 text-xs font-bold text-[#7C3AED]">
            {target.kind === "studio" ? "🎬" : "🎤"} {target.name}
          </span>
          <button type="button" onClick={() => setTarget(null)} className="rounded-full border border-[#ECECF2] bg-white px-2 py-1 text-[11px] font-bold text-[#6B7280]">
            解除 ×
          </button>
        </div>
      )}

      {!entity && tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((t) => (
            <button key={t} type="button" onClick={() => removeTag(t)} className="flex items-center gap-1 rounded-full bg-[#F1E9FE] px-3 py-1 text-xs font-bold text-[#7C3AED]">
              #{genreJa(t)} <span className="text-[10px]">×</span>
            </button>
          ))}
        </div>
      )}

      <div ref={listTopRef} className="mt-3 flex items-center justify-between scroll-mt-4">
        <h2 className="text-xs font-bold text-[#5B4FCF]">{header}</h2>
        {!entity && (
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="rounded-full border border-[#ECECF2] bg-white px-2 py-1 text-xs font-bold text-[#1C1C2E]">
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        )}
      </div>

      {entity && !target ? (
        <div className="mt-4 rounded-2xl border border-[#ECECF2] bg-white p-6 text-sm text-black/50">
          {cur.kind === "studio"
            ? "制作会社名を入力し、候補から選ぶと、その会社の制作作品が一覧表示されます（例：MAPPA、京アニ、ジブリ、ufotable）。"
            : "声優・スタッフ名を入力し、候補から選ぶと、その人の出演・参加作品が一覧表示されます。"}
        </div>
      ) : loading ? (
        <p className="mt-4 text-sm text-black/50">読み込み中…</p>
      ) : items.length === 0 && searched ? (
        <div className="mt-4 rounded-2xl border border-[#ECECF2] bg-white p-6 text-sm text-black/50">
          <p>見つかりませんでした。条件を変えてみてください。</p>
          {page > 1 && (
            <button type="button" onClick={() => goToPage(1)} className="mt-3 rounded-lg border border-[#ECECF2] bg-white px-3 py-1.5 text-xs font-bold text-[#5B4FCF]">
              ← 最初のページに戻る
            </button>
          )}
        </div>
      ) : (
        <>
          <ul className={`mt-3 divide-y divide-[#ECECF2] overflow-hidden rounded-2xl border border-[#ECECF2] bg-white transition-opacity ${paging ? "opacity-50" : ""}`}>
            {items.map((a) => (
              <li key={a.id}>
                <WorkRow {...a} />
              </li>
            ))}
          </ul>

          {(page > 1 || hasNext) && (
            <>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                <button type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1 || paging} className="rounded-lg border border-[#ECECF2] bg-white px-3 py-1.5 text-xs font-bold text-[#5B4FCF] disabled:opacity-40">← 前へ</button>
                {lo > 1 && (
                  <>
                    <button type="button" onClick={() => goToPage(1)} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#6B7280]">1</button>
                    {lo > 2 && <span className="px-1 text-xs text-black/30">…</span>}
                  </>
                )}
                {windowNums.map((n) => (
                  <button key={n} type="button" onClick={() => goToPage(n)} disabled={paging} className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${n === page ? "bg-[#5B4FCF] text-white" : "text-[#6B7280]"}`}>{n}</button>
                ))}
                <button type="button" onClick={() => goToPage(page + 1)} disabled={!hasNext || paging} className="rounded-lg border border-[#ECECF2] bg-white px-3 py-1.5 text-xs font-bold text-[#5B4FCF] disabled:opacity-40">次へ →</button>
              </div>
              <p className="mt-2 text-center text-[11px] text-black/40">
                ページ {page}
                {paging ? "　読み込み中…" : !hasNext ? "（最後）" : ""}
              </p>
            </>
          )}
        </>
      )}

      <p className="mt-6 text-[10px] text-black/40">出典：AniList</p>
    </main>
  );
}
