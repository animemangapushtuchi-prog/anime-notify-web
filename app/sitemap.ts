import type { MetadataRoute } from "next";
import { listOsusume, articleWorkIds } from "@/lib/osusume";
import { fetchPopularAroundNow } from "@/lib/anilist";
import { getPublishedEntries, latestSeasonKeyWithData, CATALOG_KEY } from "@/lib/seasonStreaming";
import { adjacentSeasonKey } from "@/lib/season";

const BASE = "https://www.animiru.com";

// サイトマップは1日キャッシュ（毎クロールでAniListを叩かない）
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 静的な主要ページ（ログイン前提の画面＝マイリスト/カレンダー/通知/設定は載せない）
  const staticUrls = [
    "",
    "/search",
    "/osusume",
    "/streaming",
    "/guide",
    "/terms",
    "/privacy",
  ].map((p) => ({
    url: `${BASE}${p}`,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.6,
  }));

  // おすすめ特集ページ。記事の更新日を lastModified として渡す
  // （更新されたことがGoogleに伝わり、再クロールされやすくなる）
  const articles = listOsusume();
  const osusume = articles.map((o) => ({
    url: `${BASE}/osusume/${o.slug}`,
    lastModified: o.updatedAt ? new Date(`${o.updatedAt}T00:00:00+09:00`) : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // 配信ページ（確認済みデータがある時だけ載せる＝空ページを入れない）
  // 日付だけで今期を決めると、季節の変わり目にデータ未投入となり
  // 掲載中だった配信ページがサイトマップから丸ごと消えてしまう。
  // そのため「公開データがある最新シーズン」を使う。
  const streaming: MetadataRoute.Sitemap = [];
  // 配信データに載っている作品も、確実な作品URLの供給源として使う
  const workIds = new Set<number>();
  const withData = new Set<number>(); // 配信情報がある作品
  try {
    const sk = await latestSeasonKeyWithData();
    // 1つ前のシーズンも残す（季節が変わっても、前期アニメは1か月ほど検索され続けるため）
    const seasons = [
      { key: sk, main: true },
      { key: adjacentSeasonKey(sk, -1), main: false },
    ];
    // 今週の放送・配信スケジュール（毎日内容が変わる）
    streaming.push({ url: `${BASE}/streaming/weekly`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.9 });
    for (const { key: season, main } of seasons) {
      const entries = await getPublishedEntries(season);
      if (entries.length === 0) continue;
      streaming.push({
        url: `${BASE}/streaming/${season}`,
        changeFrequency: main ? ("daily" as const) : ("weekly" as const),
        priority: main ? 0.9 : 0.6,
      });
      for (const key of [...new Set(entries.map((e) => e.serviceKey))]) {
        streaming.push({
          url: `${BASE}/streaming/${season}/${key}`,
          changeFrequency: "weekly" as const,
          priority: main ? 0.7 : 0.5,
        });
      }
      for (const e of entries) {
        workIds.add(e.anilistId);
        withData.add(e.anilistId);
      }
    }
  } catch (err) {
    // 握りつぶすと「作品URLが0件のサイトマップ」が黙って出続けるため、必ずログに残す
    console.error("[sitemap] 配信データの取得に失敗しました", err);
  }

  // 記事が紹介している作品のうち、配信情報がある（＝検索に出す）ものだけ載せる。
  // 以前は配信情報の無い古い作品も載せていたが、作品ページ側で noindex になるため、ここでも外す（2026-10-27）
  for (const o of articles) for (const id of articleWorkIds(o)) if (withData.has(id)) workIds.add(id);
  // 定番作品の枠（catalog）に配信情報がある作品
  try {
    for (const e of await getPublishedEntries(CATALOG_KEY)) workIds.add(e.anilistId);
  } catch (err) {
    console.error("[sitemap] 定番作品の配信データの取得に失敗しました", err);
  }

  // SEOの主役＝作品詳細。今期・来期・前期の人気作を足す。
  // AniListが落ちていても、上の2つの供給源だけで作品URLは0件にならない。
  try {
    const list = await fetchPopularAroundNow();
    for (const a of list) workIds.add(a.id);
  } catch (err) {
    console.error("[sitemap] AniListの人気作取得に失敗しました", err);
  }

  const works: MetadataRoute.Sitemap = [...workIds]
    .filter((id) => Number.isFinite(id))
    .map((id) => ({
      url: `${BASE}/work/${id}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  return [...staticUrls, ...osusume, ...works, ...streaming];
}
