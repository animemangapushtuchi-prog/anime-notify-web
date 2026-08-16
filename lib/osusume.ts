// 特集（おすすめ/まとめ）データ層。SSG用にリポジトリの content/osusume/*.json を読む。
// 新しい特集は content/osusume/ に JSON を1つ足してpushするだけで公開される。
// 将来 CMS / Firestore に移す場合はこの2関数の中身を差し替えればよい。
import fs from "fs";
import path from "path";

export type OsusumeEntry = {
  rank: number;
  workId?: number; // AniList作品ID（あると /work/[id] へリンク＋表紙自動補完）
  title: string;
  image?: string; // メインビジュアル（無ければ workId から表紙を補完）
  reviewTitle?: string;
  reviewBody?: string;
  streaming?: { name: string; url: string }[];
};

// 読み物としての本文（見出し＋段落）。ランキング形式でない解説記事はこちらを使う。
// text のほかに、比較表(table)や横棒グラフ(bars)を section 単位で置ける。
export type OsusumeSection = {
  heading: string;
  text?: string; // 段落は \n\n で区切る
  table?: {
    head: string[];
    rows: string[][];
    note?: string;
  };
  bars?: {
    items: { label: string; value: number; max?: number; suffix?: string; color?: string }[];
    note?: string;
  };
  // セクション内に並べる作品カード（表紙画像つき）。解説記事に絵を入れるために使う
  works?: {
    ids: number[]; // AniList作品ID
    note?: string;
  };
  // 補足・注意を目立たせる囲み
  callout?: {
    tone?: "info" | "warn" | "tip";
    title?: string;
    text: string;
  };
  // マスコットの吹き出し（会話調の一言。読みのリズムを作る）
  balloon?: {
    pose?: "stand" | "point" | "thumbsup" | "surprised" | "worried" | "cheer" | "search" | "sit";
    text: string;
  };
  // 数字を大きく見せるカード（3つ並べると締まる）
  stats?: {
    items: { value: string; label: string; note?: string; color?: string }[];
  };
  // 良い点・注意点の対比
  pros?: { good: string[]; bad: string[]; goodTitle?: string; badTitle?: string };
};

// 見出しから目次を作る（本文の先頭に置く）
export function tocOf(o: Osusume): { id: string; text: string }[] {
  return (o.body ?? []).map((s, i) => ({ id: `sec-${i}`, text: s.heading }));
}

// カード/ヒーローのサムネイル指定（画像が無い記事でも主題が伝わるようにする）
export type OsusumeThumbSpec = {
  label: string; // 主題（大きく出す）
  sub?: string; // 補助テキスト
  stat?: string; // 数字などの要点
  color?: string; // 背景色
  workIds?: number[]; // 背景に敷く作品カバー（AniList ID）
};

// 記事一覧・詳細でサムネ背景に使う作品IDをまとめて取り出す
export function thumbWorkIds(list: Osusume[]): number[] {
  const ids = new Set<number>();
  for (const o of list) for (const id of o.thumb?.workIds ?? []) ids.add(id);
  return [...ids];
}

// 1記事の中で表紙画像が必要な作品ID（サムネ背景＋本文の作品カード＋ランキング）
export function articleWorkIds(o: Osusume): number[] {
  const ids = new Set<number>();
  for (const id of o.thumb?.workIds ?? []) ids.add(id);
  for (const s of o.body ?? []) for (const id of s.works?.ids ?? []) ids.add(id);
  for (const e of o.entries) if (e.workId && !e.image) ids.add(e.workId);
  return [...ids];
}

export type Osusume = {
  slug: string;
  title: string;
  description?: string;
  heroImage?: string;
  thumb?: OsusumeThumbSpec; // heroImage が無いときのサムネ
  intro?: string;
  updatedAt?: string; // "2026-07-16"
  tags?: string[];
  body?: OsusumeSection[]; // 解説本文（任意）
  entries: OsusumeEntry[];
};

const DIR = path.join(process.cwd(), "content", "osusume");

export function listOsusumeSlugs(): string[] {
  try {
    return fs
      .readdirSync(DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}

export function getOsusume(slug: string): Osusume | null {
  try {
    const raw = fs.readFileSync(path.join(DIR, `${slug}.json`), "utf8");
    const data = JSON.parse(raw) as Osusume;
    return { ...data, slug };
  } catch {
    return null;
  }
}

export function listOsusume(): Osusume[] {
  const list = listOsusumeSlugs()
    .map(getOsusume)
    .filter((x): x is Osusume => x !== null);
  list.sort(
    (a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.slug.localeCompare(b.slug)
  );
  return list;
}
