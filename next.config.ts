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

const nextConfig: NextConfig = {
  async redirects() {
    return REMOVED_ARTICLES.map((slug) => ({
      source: `/osusume/${slug}`,
      destination: "/osusume/2026-aki-anime-haishin",
      permanent: true,
    }));
  },
};

export default nextConfig;
