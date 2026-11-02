// 人気アニメの配信早見表（/streaming/library）のデータ。定番作品の枠（catalog）の確認済み配信情報を作品ごとにまとめ、人気順に並べる。
import { fetchPopularity } from "@/lib/anilist";
import { CATALOG_KEY, getPublishedEntries } from "@/lib/seasonStreaming";
import { STREAM_SERVICES } from "@/lib/streaming";

export type LibraryWork = { id: number; title: string; cover: string; services: { key: string; name: string }[] };

const ORDER = new Map(STREAM_SERVICES.map((s, i) => [s.key, i]));

export async function getLibrary(): Promise<{ works: LibraryWork[]; checkedAt: number | null }> {
  const entries = await getPublishedEntries(CATALOG_KEY).catch(() => []);
  const map = new Map<number, LibraryWork>();
  let checkedAt: number | null = null;
  for (const e of entries) {
    const w = map.get(e.anilistId) ?? { id: e.anilistId, title: e.title, cover: e.coverImage, services: [] };
    if (e.availability !== "rental") w.services.push({ key: e.serviceKey, name: e.serviceName });
    if (!w.cover) w.cover = e.coverImage;
    map.set(e.anilistId, w);
    if (e.sourceCheckedAt && (!checkedAt || e.sourceCheckedAt > checkedAt)) checkedAt = e.sourceCheckedAt;
  }
  const works = [...map.values()].filter((w) => w.services.length > 0);
  for (const w of works) w.services.sort((a, b) => (ORDER.get(a.key) ?? 99) - (ORDER.get(b.key) ?? 99));
  // AniList の人気順。取れなかったときは作品名の順にする（ページは落とさない）
  const pop = await fetchPopularity(works.map((w) => w.id)).catch(() => ({} as Record<number, number>));
  works.sort((a, b) => (pop[b.id] ?? 0) - (pop[a.id] ?? 0) || a.title.localeCompare(b.title, "ja"));
  return { works, checkedAt };
}

// サービスごとの作品数（多い順）
export function libraryServices(works: LibraryWork[]): { key: string; name: string; count: number }[] {
  const m = new Map<string, { key: string; name: string; count: number }>();
  for (const w of works) {
    for (const s of w.services) {
      const c = m.get(s.key) ?? { key: s.key, name: s.name, count: 0 };
      c.count++;
      m.set(s.key, c);
    }
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}
