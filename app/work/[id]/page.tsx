import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getWorkEntries, seasonKeyFromLabel, type PublicEntry } from "@/lib/seasonStreaming";
import { currentSeasonKey, adjacentSeasonKey } from "@/lib/season";
import { fetchAnimeDetail, genreJa, type AnimeDetail } from "@/lib/anilist";
import { fetchWikipediaJa } from "@/lib/wikipedia";
import Trailer from "@/components/Trailer";
import Collapsible from "@/components/Collapsible";
import RegisterButton from "@/components/RegisterButton";
import RelatedWorks from "@/components/RelatedWorks";
import BroadcastInfo from "@/components/BroadcastInfo";
import StreamingLinks from "@/components/StreamingLinks";
import NextBroadcast from "@/components/NextBroadcast";
import AdSlot from "@/components/AdSlot";

// ISR：1時間ごとに再生成
export const revalidate = 3600;

const CARD = "rounded-3xl border border-line bg-white p-5 lg:p-6";
const CARD_TITLE = "flex items-center gap-2 text-[15px] font-black text-ink";

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

// 管理画面で確認済みの配信情報（この作品ぶん）。サーバー側で読んでHTMLに含める。
// 作品自身のシーズン＋今期の前後を見るので、公開直後の来期作品や、季節が変わった後の前期作品も表示される。
// 各シーズンの公開データは1文書にまとまっているので、読み取りはシーズンごとに1回（最大4回）。
const loadConfirmed = cache(async (id: number, seasonLabelJa: string): Promise<PublicEntry[]> => {
  const now = currentSeasonKey();
  return getWorkEntries(id, [
    seasonKeyFromLabel(seasonLabelJa) ?? "",
    now,
    adjacentSeasonKey(now, -1),
    adjacentSeasonKey(now, 1),
  ]).catch(() => []);
});

// 検索結果に出る説明文を作る。
// Wikipediaの導入部は「その作品の記事だと確認できたときだけ」使う（lib/wikipedia.ts で照合済み）。
// 取れなかった場合でも空にせず、サイトが持っている情報から説明文を組み立てる。
function buildDescription(d: AnimeDetail, wikiExtract?: string, confirmedNames: string[] = []): string {
  const facts: string[] = [];
  if (d.seasonLabel) facts.push(d.seasonLabel);
  if (d.type) facts.push(d.type);
  if (d.studios?.length) facts.push(`${d.studios.slice(0, 2).join("・")}制作`);

  // 管理画面で確認済みの国内配信サービスを優先（AniListは海外配信が中心のため）
  const services = [
    ...new Set([...confirmedNames, ...(d.streaming ?? []).map((s) => s.name)].filter(Boolean)),
  ];
  const head = `「${d.title}」の配信・放送情報。`;
  const factLine = facts.length ? `${facts.join("／")}。` : "";
  const svcLine = services.length
    ? `${services.slice(0, 4).join("・")}などの配信状況と、最新話の放送予定をまとめています。`
    : "配信サービスの対応状況と、最新話の放送予定をまとめています。";

  // Wikipediaのあらすじが取れていれば、残り文字数に収まる範囲で足す
  const base = head + factLine + svcLine;
  if (wikiExtract) {
    const room = 150 - base.length;
    if (room > 30) return (base + wikiExtract.replace(/\s+/g, " ").slice(0, room)).slice(0, 160);
  }
  return base.slice(0, 160);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const r = await load(id);
  if (!r) return { title: "作品が見つかりません｜アニミル！" };
  const { d, wiki } = r;
  const confirmed = await loadConfirmed(d.id, d.seasonLabel);
  // 照合できたWikipedia本文だけを足す。AniListのsynopsisは英語やHTMLが混ざるので使わない。
  const desc = buildDescription(
    d,
    wiki?.extract || "",
    confirmed.map((c) => c.serviceName)
  );
  // 「作品名 配信」「作品名 どこで見れる」で探している人に届く形にする
  const pageTitle = `${d.title}はどこで見れる？配信・放送情報｜アニミル！`;
  return {
    title: pageTitle,
    description: desc,
    alternates: { canonical: `https://www.animiru.com/work/${d.id}` },
    openGraph: {
      title: pageTitle,
      description: desc,
      url: `https://www.animiru.com/work/${d.id}`,
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
  const confirmed = await loadConfirmed(d.id, d.seasonLabel);

  return (
    <main className="mx-auto max-w-5xl px-3 pb-6 sm:px-4 lg:px-8 xl:max-w-6xl 2xl:max-w-[1280px]">
      {/* ヒーロー：表紙をぼかして夜空のように敷く。上段＝表紙＋基本情報、下段＝紹介文＋動画 */}
      <section className="relative isolate overflow-hidden rounded-[28px] bg-night text-white shadow-[0_30px_80px_-40px_rgba(21,17,42,0.9)]">
        {d.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.coverUrl} alt="" aria-hidden="true" className="absolute inset-0 -z-20 h-full w-full scale-125 object-cover opacity-70 blur-3xl" />
        )}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-night/20 via-night/70 to-night" />
        <div aria-hidden="true" className="starfield absolute inset-0 -z-10 opacity-60" />

        <div className="p-5 sm:p-8 lg:p-10">
          <div className="flex gap-5 sm:gap-8">
            {d.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={d.coverUrl}
                alt={d.title}
                className="h-44 w-[118px] flex-none rounded-2xl object-cover shadow-[0_20px_40px_-12px_rgba(0,0,0,0.7)] ring-1 ring-white/15 sm:h-64 sm:w-44"
              />
            )}
            <div className="min-w-0 self-end pb-1">
              <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                <span className="rounded-full bg-white/12 px-2.5 py-1 ring-1 ring-white/15">{d.type}</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${d.status === "放送中" ? "bg-[#C0392B]" : "bg-white/12 ring-1 ring-white/15"}`}>
                  {d.status === "放送中" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  {d.status}
                </span>
              </p>
              <h1 className="mt-3 text-[24px] font-black leading-[1.25] sm:text-[34px] lg:text-[42px]">{d.title}</h1>
              {d.titleRomaji && <p className="mt-1.5 text-xs text-white/60 sm:text-sm">{d.titleRomaji}</p>}
              <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {d.seasonLabel && (
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">Season</dt>
                    <dd className="font-bold">{d.seasonLabel}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">Episodes</dt>
                  <dd className="font-bold">{d.episodes != null ? <><span className="num">{d.episodes}</span>話</> : "未定"}</dd>
                </div>
                {d.score != null && (
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">Score</dt>
                    <dd className="num font-bold text-bell">★ {d.score}</dd>
                  </div>
                )}
                {d.sourceJa && (
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">Original</dt>
                    <dd className="font-bold">{d.sourceJa}</dd>
                  </div>
                )}
                {d.studios.length > 0 && (
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">Studio</dt>
                    <dd className="font-bold">{d.studios.join("、")}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          <div className={`mt-7 gap-8 ${d.trailerVideoId ? "md:grid md:grid-cols-[1fr_0.9fr]" : ""}`}>
            <div className="min-w-0">
              {(wiki?.extract || d.synopsis) && (
                <div>
                  <p className="whitespace-pre-line text-[13px] leading-[1.9] text-white/85 line-clamp-6">
                    {wiki?.extract || d.synopsis}
                  </p>
                  <p className="mt-2 text-[10px] text-white/60">
                    出典：{wiki ? "Wikipedia（CC BY-SA）" : "AniList"}
                  </p>
                </div>
              )}
              {d.genres.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {d.genres.map((g) => (
                    <Link
                      key={g}
                      href={`/search?genre=${encodeURIComponent(g)}`}
                      className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold ring-1 ring-white/15 transition hover:bg-white/20"
                    >
                      #{genreJa(g)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {d.trailerVideoId && (
              <div className="mt-6 md:mt-0">
                <Trailer videoId={d.trailerVideoId} thumb={d.trailerThumb} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 登録ボタン */}
      <div className="mt-5">
        <RegisterButton
          work={{
            id: d.id,
            title: d.title,
            meta: [d.type, d.seasonLabel].filter(Boolean).join("・"),
            status: d.status === "放送中" ? "RELEASING" : "FINISHED",
            cover: d.coverUrl,
            episodes: d.episodes ?? undefined,
          }}
        />
      </div>

      {/* 次回のテレビ放送（ネット配信チャンネルは除外） */}
      <NextBroadcast
        title={d.title}
        fallbackAt={d.nextAiringAt ?? null}
        fallbackEp={d.nextEpisode ?? null}
      />

      {/* ネット配信はテレビ放送と混ぜない。
          確認済みデータはサーバーで読んで渡す（HTMLに入る）。番組表(配信枠)の統合だけクライアント側で行う */}
      <section className={`${CARD} mt-4 border-[#F3D9A9] bg-amber-wash`}>
        <h2 className={CARD_TITLE}><span aria-hidden="true" className="h-4 w-1 rounded-full bg-amber" />ネット配信</h2>
        {confirmed.length > 0 && (
          <p className="mt-1 text-sm leading-relaxed text-[#1A1523]">
            「{d.title}」は、{confirmed.map((c) => c.serviceName).join("・")}で配信されています。
          </p>
        )}
        <StreamingLinks
          items={d.streaming.map((s) => ({ name: s.name, url: s.url }))}
          title={d.title}
          workId={d.id}
          confirmed={confirmed}
          seasonKey={seasonKeyFromLabel(d.seasonLabel) ?? undefined}
        />
      </section>

      {/* 2カラム（ワイド）／縦積み（狭幅） */}
      <div className="mt-4 md:grid md:grid-cols-2 md:items-start md:gap-4">
        {/* 左列 */}
        <div className="space-y-4">
          {/* テレビ放送（地上波・BS・CS） */}
          <section className={CARD}>
            <h2 className={CARD_TITLE}><span aria-hidden="true" className="h-4 w-1 rounded-full bg-night-3" />テレビ放送<span className="text-xs font-bold text-ink-2">地上波・BS・CS</span></h2>
            <BroadcastInfo title={d.title} />
            <p className="mt-1 text-[10px] text-[#625B6E]">出典：しょぼいカレンダー</p>
          </section>
        </div>

        {/* 右列 */}
        <div className="mt-4 space-y-4 md:mt-0">
          {/* 公式リンク（X） */}
          {d.xHandle && (
            <section className={CARD}>
              <h2 className={CARD_TITLE}><span aria-hidden="true" className="h-4 w-1 rounded-full bg-ink" />公式リンク</h2>
              <a
                href={`https://x.com/${d.xHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-3 py-1"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-black text-lg font-black text-white">
                  X
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-bold text-[#1A1523]">公式X（旧Twitter）</span>
                  <span className="block text-[11px] text-[#625B6E]">最新ポストを見る</span>
                </span>
                <span className="text-xs font-bold text-[#8A5518]">開く ›</span>
              </a>
            </section>
          )}

          {/* 声優 */}
          {d.cast.length > 0 && (
            <Collapsible title="声優">
              <ul className="space-y-2">
                {d.cast.map((c, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="w-40 flex-none text-xs text-[#625B6E]">{c.character}</span>
                    <Link
                      href={`/search?person=${encodeURIComponent(c.actor)}`}
                      className="font-semibold text-[#C2772A] underline-offset-2 hover:underline"
                    >
                      {c.actor}
                    </Link>
                  </li>
                ))}
              </ul>
            </Collapsible>
          )}

          {/* スタッフ */}
          {d.staff.length > 0 && (
            <Collapsible title="スタッフ">
              <ul className="space-y-2">
                {d.staff.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="w-28 flex-none text-xs text-[#625B6E]">{s.role}</span>
                    <span className="font-semibold text-[#1A1523]">{s.name}</span>
                  </li>
                ))}
              </ul>
            </Collapsible>
          )}

          {/* シリーズ・関連作品（公開順の目安＋まとめて登録） */}
          {d.relations.length > 0 && (
            <Collapsible title="シリーズ・関連作品">
              <RelatedWorks id={d.id} fallback={d.relations} />
            </Collapsible>
          )}
        </div>
      </div>

      <AdSlot className="mt-6" />
    </main>
  );
}
