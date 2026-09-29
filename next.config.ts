import type { NextConfig } from "next";

// 2026-09-29 に取り下げたジャンル別「おすすめ7選」記事。
// 作品を実際に見ていないまま出来を評価していた・タイトルの本数と中身が合っていなかったため削除した。
// 検索やブックマークから来た人は、事実だけで作った秋アニメの配信まとめ記事へ転送する。
const REMOVED_ARTICLES = [
  "battle-anime",
  "ikkimi-anime-2026",
  "kazoku-anime",
  "mystery-anime",
  "nichijou-anime",
  "ongaku-anime",
  "renai-anime",
  "sf-anime",
  "short-anime",
  "sports-anime",
];

// 同じ日に取り下げた、見ていない作品の感想・評価が中心だった記事。内容に近いページへ転送する。
const REMOVED_REVIEW_ARTICLES: Record<string, string> = {
  "2026-summer-anime-10": "/streaming/2026-summer",
  "isekai-anime-2026": "/streaming/2026-summer",
  "zokuhen-anime-2026": "/streaming/2026-summer",
  "meisaku-anime-5": "/osusume/anime-beginner-guide",
};

const nextConfig: NextConfig = {
  async redirects() {
    return [
      ...REMOVED_ARTICLES.map((slug) => ({
        source: `/osusume/${slug}`,
        destination: "/osusume/2026-aki-anime-haishin",
        permanent: true,
      })),
      ...Object.entries(REMOVED_REVIEW_ARTICLES).map(([slug, destination]) => ({
        source: `/osusume/${slug}`,
        destination,
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;
