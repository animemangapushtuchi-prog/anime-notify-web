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

export type Osusume = {
  slug: string;
  title: string;
  description?: string;
  heroImage?: string;
  intro?: string;
  updatedAt?: string; // "2026-07-16"
  tags?: string[];
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
