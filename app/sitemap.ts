import type { MetadataRoute } from "next";
import { listOsusumeSlugs } from "@/lib/osusume";
import { fetchSeasonPopular } from "@/lib/anilist";
import { currentSeasonKey } from "@/lib/season";
import { getPublishedEntries } from "@/lib/seasonStreaming";

const BASE = "https://www.animiru.com";

// サイトマップは1日キャッシュ（毎クロールでAniListを叩かない）
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 静的な主要ページ（ログイン前提の画面は載せない）
  const staticUrls = ["", "/search", "/osusume", "/guide", "/terms", "/privacy"].map(
    (p) => ({
      url: `${BASE}${p}`,
      changeFrequency: "weekly" as const,
      priority: p === "" ? 1 : 0.6,
    })
  );

  // おすすめ特集ページ
  const osusume = listOsusumeSlugs().map((slug) => ({
    url: `${BASE}/osusume/${slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // SEOの主役＝作品詳細。今期人気を最大60件だけ載せる（全作品は載せない）
  let works: MetadataRoute.Sitemap = [];
  try {
    const list = await fetchSeasonPopular();
    works = list.slice(0, 60).map((a) => ({
      url: `${BASE}/work/${a.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    /* 取得失敗時は作品なしで返す（サイトマップ自体は必ず生成される） */
  }

  // 今期配信ページ（確認済みデータがある時だけ載せる＝空ページを入れない）
  let streaming: MetadataRoute.Sitemap = [];
  try {
    const sk = currentSeasonKey();
    const entries = await getPublishedEntries(sk);
    if (entries.length > 0) {
      streaming.push({
        url: `${BASE}/streaming/${sk}`,
        changeFrequency: "daily" as const,
        priority: 0.9,
      });
      for (const key of [...new Set(entries.map((e) => e.serviceKey))]) {
        streaming.push({
          url: `${BASE}/streaming/${sk}/${key}`,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        });
      }
    }
  } catch {
    /* 取得失敗時は今期配信URLなしで返す */
  }

  return [...staticUrls, ...osusume, ...works, ...streaming];
}
