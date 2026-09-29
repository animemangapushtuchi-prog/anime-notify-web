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

const CARD = "rounded-2xl border border-[#ECECF2] bg-white p-4";
const CARD_TITLE = "text-[13px] font-bold text-[#6B7280]";

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

  const meta = [
    d.seasonLabel,
    d.episodes != null ? `全${d.episodes}話` : "話数未定",
    d.score != null ? `★${d.score}` : "",
  ]
    .filter(Boolean)
    .join("　");

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      {/* ヒーロー：ワイドは [左=プロフィール+紹介+ジャンル | 右=動画] */}
      <section
        style={{ background: "linear-gradient(to bottom right, #3B3670, #C2772A)" }}
        className="overflow-hidden rounded-2xl p-4 text-white"
      >
        <div className="md:flex md:gap-4">
          {/* 左：プロフィール */}
          <div className="min-w-0 md:flex-1">
            <div className="flex gap-4">
              {d.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={d.coverUrl}
                  alt={d.title}
                  className="h-40 w-28 flex-none rounded-lg object-cover"
                />
              )}
              <div className="min-w-0">
                <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
                  {d.type}・{d.status}
                </span>
                <h1 className="mt-2 text-xl font-extrabold leading-snug">{d.title}</h1>
                {d.titleRomaji && (
                  <p className="mt-0.5 text-xs text-white/70">{d.titleRomaji}</p>
                )}
                <p className="mt-2 text-sm text-white/85">{meta}</p>
                {(d.sourceJa || d.studios.length > 0) && (
                  <p className="mt-1 text-xs text-white/85">
                    {[
                      d.sourceJa && `原作：${d.sourceJa}`,
                      d.studios.length > 0 && `制作：${d.studios.join("、")}`,
                    ]
                      .filter(Boolean)
                      .join("　")}
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
                  <Link
                    key={g}
                    href={`/search?genre=${encodeURIComponent(g)}`}
                    className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold hover:bg-white/30"
                  >
                    #{genreJa(g)}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 右：動画（ワイドは右半分、狭幅はプロフィールの下） */}
          {d.trailerVideoId && (
            <div className="mt-4 md:mt-0 md:w-[44%] md:flex-none md:self-start">
              <Trailer videoId={d.trailerVideoId} thumb={d.trailerThumb} />
            </div>
          )}
        </div>
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
      <section className={`${CARD} mt-4 border-[#F3D9A9] bg-[#FBF3E6]`}>
        <h2 className={CARD_TITLE}>▶ ネット配信</h2>
        {confirmed.length > 0 && (
          <p className="mt-1 text-sm leading-relaxed text-[#1C1C2E]">
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
            <h2 className={CARD_TITLE}>📺 テレビ放送（地上波・BS・CS）</h2>
            <BroadcastInfo title={d.title} />
            <p className="mt-1 text-[10px] text-[#6B7280]">出典：しょぼいカレンダー</p>
          </section>
        </div>

        {/* 右列 */}
        <div className="mt-4 space-y-4 md:mt-0">
          {/* 公式リンク（X） */}
          {d.xHandle && (
            <section className={CARD}>
              <h2 className={CARD_TITLE}>🔗 公式リンク</h2>
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
                  <span className="block text-sm font-bold text-[#1C1C2E]">公式X（旧Twitter）</span>
                  <span className="block text-[11px] text-[#6B7280]">最新ポストを見る</span>
                </span>
                <span className="text-xs font-bold text-[#8A5518]">開く ›</span>
              </a>
            </section>
          )}

          {/* 声優 */}
          {d.cast.length > 0 && (
            <Collapsible title="🎙 声優">
              <ul className="space-y-2">
                {d.cast.map((c, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="w-40 flex-none text-xs text-[#6B7280]">{c.character}</span>
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
            <Collapsible title="🎬 スタッフ">
              <ul className="space-y-2">
                {d.staff.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="w-28 flex-none text-xs text-[#6B7280]">{s.role}</span>
                    <span className="font-semibold text-[#1C1C2E]">{s.name}</span>
                  </li>
                ))}
              </ul>
            </Collapsible>
          )}

          {/* シリーズ・関連作品（公開順の目安＋まとめて登録） */}
          {d.relations.length > 0 && (
            <Collapsible title="🔗 シリーズ・関連作品">
              <RelatedWorks id={d.id} fallback={d.relations} />
            </Collapsible>
          )}
        </div>
      </div>

      <AdSlot className="mt-6" />
    </main>
  );
}
