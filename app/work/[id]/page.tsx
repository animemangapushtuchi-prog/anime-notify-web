import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchAnimeDetail, svcRank, type AnimeDetail } from "@/lib/anilist";
import { fetchWikipediaJa } from "@/lib/wikipedia";
import Trailer from "@/components/Trailer";
import Collapsible from "@/components/Collapsible";
import RegisterButton from "@/components/RegisterButton";

// ISR：1時間ごとに再生成（AniList/Wikipediaの更新を反映しつつ高速）
export const revalidate = 3600;

const WD = ["月", "火", "水", "木", "金", "土", "日"];
function fmtAiring(unixSec: number): string {
  const d = new Date((unixSec + 9 * 3600) * 1000); // JST
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WD[(d.getUTCDay() + 6) % 7]}）${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

const load = cache(
  async (
    idStr: string
  ): Promise<{ d: AnimeDetail; wiki: Awaited<ReturnType<typeof fetchWikipediaJa>> } | null> => {
    const id = Number(idStr);
    if (!Number.isFinite(id)) return null;
    const d = await fetchAnimeDetail(id);
    if (!d) return null;
    const wiki = await fetchWikipediaJa(d.title);
    return { d, wiki };
  }
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const r = await load(id);
  if (!r) return { title: "作品が見つかりません" };
  const { d, wiki } = r;
  const desc = (wiki?.extract || d.synopsis || "").slice(0, 120);
  return {
    title: `${d.title}｜アニメ・漫画 新着通知`,
    description: desc,
    openGraph: {
      title: d.title,
      description: desc,
      images: d.coverUrl ? [d.coverUrl] : [],
      type: "article",
    },
  };
}

export default async function WorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await load(id);
  if (!r) notFound();
  const { d, wiki } = r;

  const meta = [
    d.seasonLabel,
    d.episodes != null ? `全${d.episodes}話` : "話数未定",
    d.score != null ? `★${d.score}` : "",
  ].filter(Boolean).join("　");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {/* ヒーロー */}
      <section
        style={{ background: "linear-gradient(to bottom right, #3B3670, #5B4FCF)" }}
        className="overflow-hidden rounded-2xl p-4 text-white"
      >
        <div className="flex gap-4">
          {d.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.coverUrl} alt={d.title} className="h-40 w-28 flex-none rounded-lg object-cover" />
          )}
          <div className="min-w-0">
            <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
              {d.type}・{d.status}
            </span>
            <h1 className="mt-2 text-xl font-extrabold leading-snug">{d.title}</h1>
            {d.titleRomaji && <p className="mt-0.5 text-xs text-white/70">{d.titleRomaji}</p>}
            <p className="mt-2 text-sm text-white/85">{meta}</p>
            {(d.sourceJa || d.studios.length > 0) && (
              <p className="mt-1 text-xs text-white/85">
                {[d.sourceJa && `原作：${d.sourceJa}`, d.studios.length > 0 && `制作：${d.studios.join("、")}`].filter(Boolean).join("　")}
              </p>
            )}
          </div>
        </div>

        {(wiki?.extract || d.synopsis) && (
          <div className="mt-4">
            <p className="whitespace-pre-line text-xs leading-relaxed text-white/95 line-clamp-6">
              {wiki?.extract || d.synopsis}
            </p>
            <p className="mt-1 text-[10px] text-white/70">
              出典：{wiki ? "Wikipedia（CC BY-SA）" : "AniList"}
            </p>
          </div>
        )}

        {d.genres.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {d.genres.map((g) => (
              <span key={g} className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold">
                {g}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 登録ボタン */}
      <div className="mt-4">
        <RegisterButton
          work={{
            id: d.id,
            title: d.title,
            meta: [d.type, d.seasonLabel].filter(Boolean).join("・"),
            status: d.status === "放送中" ? "RELEASING" : "FINISHED",
            cover: d.coverUrl,
          }}
        />
      </div>

      {/* PV */}
      {d.trailerVideoId && (
        <section className="mt-4">
          <Trailer videoId={d.trailerVideoId} thumb={d.trailerThumb} />
        </section>
      )}

      {/* 次回の放送 */}
      {d.nextAiringAt && (
        <section className="mt-4 rounded-2xl border border-[#F3D9A9] bg-[#E8F0FE] p-4">
          <h2 className="text-xs font-bold text-black/60">📅 次回の放送・配信</h2>
          <p className="mt-1 text-base font-extrabold">
            第{d.nextEpisode}話　{fmtAiring(d.nextAiringAt)}
          </p>
          <p className="mt-1 text-[10px] text-black/50">出典：AniList（日本時間）</p>
        </section>
      )}

      {/* 配信サービス（日本向けのみ） */}
      <section className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
        <h2 className="text-xs font-bold text-black/60">▶ 配信中のサービス</h2>
        {d.streaming.length === 0 ? (
          <p className="mt-2 text-xs text-black/50">日本で見られる配信情報が見つかりませんでした</p>
        ) : (
          <ul className="mt-1">
            {d.streaming.map((s) => (
              <li key={s.name}>
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                   className="flex items-center justify-between py-2">
                  <span className="text-sm font-bold">{s.name}</span>
                  <span className="text-xs text-black/40">
                    {svcRank(s.name, s.language) >= 40 ? "海外向け配信" : "公式配信"} ›
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[10px] text-black/40">出典：AniList</p>
      </section>

      {/* 公式リンク（X） */}
      {d.xHandle && (
        <section className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
          <h2 className="text-xs font-bold text-black/60">🔗 公式リンク</h2>
          <a href={`https://x.com/${d.xHandle}`} target="_blank" rel="noopener noreferrer"
             className="mt-2 flex items-center gap-3 py-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-black text-lg font-black text-white">X</span>
            <span className="flex-1">
              <span className="block text-sm font-bold">公式X（旧Twitter）</span>
              <span className="block text-[11px] text-black/50">最新ポストを見る</span>
            </span>
            <span className="text-xs font-bold text-[#5B4FCF]">開く ›</span>
          </a>
        </section>
      )}

      {/* 声優・スタッフ・関連作品（折りたたみ） */}
      {d.cast.length > 0 && (
        <section className="mt-4">
          <Collapsible title="🎙 声優">
            <ul className="space-y-2">
              {d.cast.map((c, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="w-40 flex-none text-xs text-black/50">{c.character}</span>
                  <span className="font-semibold">{c.actor}</span>
                </li>
              ))}
            </ul>
          </Collapsible>
        </section>
      )}
      {d.staff.length > 0 && (
        <section className="mt-4">
          <Collapsible title="🎬 スタッフ">
            <ul className="space-y-2">
              {d.staff.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="w-28 flex-none text-xs text-black/50">{s.role}</span>
                  <span className="font-semibold">{s.name}</span>
                </li>
              ))}
            </ul>
          </Collapsible>
        </section>
      )}
      {d.relations.length > 0 && (
        <section className="mt-4">
          <Collapsible title="🔗 関連作品">
            <ul className="space-y-2">
              {d.relations.map((r2) => (
                <li key={r2.id} className="text-sm">
                  {r2.mediaType === "ANIME" ? (
                    <a href={`/work/${r2.id}`} className="font-semibold text-[#5B4FCF] hover:underline">
                      {r2.title} <span className="text-xs text-black/40">（{r2.relation}）›</span>
                    </a>
                  ) : (
                    <span>
                      {r2.title} <span className="text-xs text-black/40">（{r2.relation}）</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Collapsible>
        </section>
      )}
    </main>
  );
}
