// 広告とアフィリエイトの設定（content/ads.json）を読む。
// 2026-10-29：AdSense 以外の広告と、配信サービスの紹介（アフィリエイト）を入れられるようにした。
// 設定が空のときは何も表示しない（審査前・登録前でもサイトの見た目は変わらない）。
import config from "@/content/ads.json";

export type AffiliateLink = {
  url: string; // ASP でもらった広告リンク
  pixel?: string; // 表示回数の計測用 1x1 画像（ASP によっては必須）
  text?: string; // ボタンの文字。無ければ「◯◯の公式サイトへ」
};

export type DisplaySlot = {
  html: string; // 広告会社のタグ（そのまま貼る）
  width: number;
  height: number;
};

type Config = {
  affiliate: { services: Record<string, AffiliateLink>; amazonAssociate: boolean };
  display: { slots: Record<string, DisplaySlot> };
  adsTxt: string[];
};

const C = config as unknown as Config;

const isHttps = (u: unknown): u is string => typeof u === "string" && /^https:\/\//.test(u);

export function affiliateFor(serviceKey: string): AffiliateLink | null {
  const a = C.affiliate?.services?.[serviceKey];
  return a && isHttps(a.url) ? a : null;
}

export function hasAnyAffiliate(): boolean {
  return Object.keys(C.affiliate?.services ?? {}).some((k) => affiliateFor(k));
}

// Amazon アソシエイトに参加したら true にする。規約で決まった文をプライバシーポリシーとフッターに出す
export function isAmazonAssociate(): boolean {
  return C.affiliate?.amazonAssociate === true;
}

export function displaySlot(name: string): DisplaySlot | null {
  const s = C.display?.slots?.[name];
  return s && typeof s.html === "string" && s.html.trim() && s.width > 0 && s.height > 0 ? s : null;
}

export function displaySlotNames(): string[] {
  return Object.keys(C.display?.slots ?? {}).filter((k) => displaySlot(k));
}

export function hasAnyAd(): boolean {
  return hasAnyAffiliate() || displaySlotNames().length > 0;
}

// ads.txt に足す行（広告会社ごとに指定される）。AdSense の行は app/ads.txt/route.ts で常に出す
export function extraAdsTxtLines(): string[] {
  return (C.adsTxt ?? []).filter((l) => typeof l === "string" && l.trim() && !l.includes("\n"));
}
