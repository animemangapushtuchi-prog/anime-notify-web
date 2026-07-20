import type { MetadataRoute } from "next";

// クローラーは全許可。サイトマップの場所を明示してクロールを促す。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://www.animiru.com/sitemap.xml",
    host: "https://www.animiru.com",
  };
}
