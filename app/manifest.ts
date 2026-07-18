import type { MetadataRoute } from "next";

// PWA マニフェスト（/manifest.webmanifest として配信される）
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "アニミル！（Animiru）",
    short_name: "アニミル！",
    description: "登録した作品の新話放送・配信入りを自動で通知。放送カレンダー・今期アニメ・おすすめ特集も。",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F6FA",
    theme_color: "#C2772A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
