// SEO/OGPの共通値。
// Next.js の metadata は、ページ側で openGraph を書くとレイアウト側の openGraph が
// 丸ごと置き換わる（マージされない）。画像が消えるのを防ぐため、
// 独自の画像を持たないページはこの既定画像を明示的に足す。
export const OG_IMAGE = "/icon-512.png";
