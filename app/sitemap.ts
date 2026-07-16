import type { MetadataRoute } from "next";
import { listOsusumeSlugs } from "@/lib/osusume";

const BASE = "https://animiru.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticUrls = ["", "/search", "/osusume", "/guide", "/terms", "/privacy"].map((p) => ({
    url: `${BASE}${p}`,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.6,
  }));
  const osusume = listOsusumeSlugs().map((slug) => ({
    url: `${BASE}/osusume/${slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  return [...staticUrls, ...osusume];
}
