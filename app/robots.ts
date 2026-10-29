import type { MetadataRoute } from "next";

// クローラーは全許可。サイトマップの場所を明示してクロールを促す。
export default function robots(): MetadataRoute.Robots {
  return {
    // /ad-frame/ は広告を出すための小さなページ（AdSlot が iframe で読む）。検索には不要
    rules: { userAgent: "*", allow: "/", disallow: "/ad-frame/" },
    sitemap: "https://www.animiru.com/sitemap.xml",
    host: "https://www.animiru.com",
  };
}
