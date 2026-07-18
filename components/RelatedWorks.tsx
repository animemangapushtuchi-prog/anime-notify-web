"use client";

// 関連作品：前作・続編チェーンをたどってシリーズ全体を復元し、映画・原作・OVA等をグループ表示。
// 開いた時（親のCollapsibleが開く）に初めて実行される＝AniList負荷の軽減。
import { useEffect, useState } from "react";
import { fetchSeriesInfo, formatJa, type SeriesEntry, type RelatedWork } from "@/lib/anilist";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-[#6B7280]">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function AnimeRow({ id, label }: { id: number; label: string }) {
  return (
    <a href={`/work/${id}`} className="flex items-center justify-between py-1 text-sm">
      <span className="font-semibold text-[#C2772A] hover:underline">{label}</span>
      <span className="flex-none text-black/30">›</span>
    </a>
  );
}

export default function RelatedWorks({
  id,
  fallback,
}: {
  id: number;
  fallback: RelatedWork[];
}) {
  const [data, setData] = useState<{
    chain: SeriesEntry[];
    related: RelatedWork[];
    complete: boolean;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSeriesInfo(id)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setData({ chain: [], related: fallback, complete: false });
      });
    return () => {
      alive = false;
    };
  }, [id, fallback]);

  if (!data) {
    return <p className="py-1 text-xs text-black/50">シリーズ全体を確認中…</p>;
  }

  const related = data.related.length > 0 ? data.related : fallback;
  const movies = related.filter((r) => r.format === "MOVIE");
  const otherAnime = related.filter(
    (r) => r.mediaType === "ANIME" && r.format !== "MOVIE"
  );
  const manga = related.filter((r) => r.mediaType === "MANGA");

  const empty =
    data.chain.length === 0 &&
    movies.length === 0 &&
    otherAnime.length === 0 &&
    manga.length === 0;

  return (
    <div className="space-y-3">
      {data.chain.length > 0 && (
        <Section title="アニメシリーズ">
          {data.chain.map((c) => (
            <AnimeRow
              key={c.id}
              id={c.id}
              label={`${c.title}${c.episodes ? ` 全${c.episodes}話` : ""}${
                c.isCurrent ? "（この作品）" : ""
              }`}
            />
          ))}
        </Section>
      )}
      {movies.length > 0 && (
        <Section title="劇場版・映画">
          {movies.map((r) => (
            <AnimeRow key={r.id} id={r.id} label={r.title} />
          ))}
        </Section>
      )}
      {otherAnime.length > 0 && (
        <Section title="その他のアニメ（OVA・SP等）">
          {otherAnime.map((r) => (
            <AnimeRow key={r.id} id={r.id} label={`${r.title}（${r.relation}）`} />
          ))}
        </Section>
      )}
      {manga.length > 0 && (
        <Section title="原作・漫画・小説">
          {manga.map((r) => (
            <p key={r.id} className="py-1 text-sm text-[#1C1C2E]">
              {r.title}
              <span className="ml-1 text-xs text-[#6B7280]">
                （{formatJa(r.format)}）
              </span>
            </p>
          ))}
        </Section>
      )}
      {empty && <p className="py-1 text-xs text-black/50">関連作品は見つかりませんでした。</p>}
      {!data.complete && (
        <p className="text-[10px] text-black/40">
          ※ 一部が読み込めませんでした（開き直すと再取得します）
        </p>
      )}
    </div>
  );
}
