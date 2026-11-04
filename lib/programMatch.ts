// 番組表（しょぼいカレンダー）の題名と AniList の作品を突き合わせる（トップの「今日これからの放送」の表紙用）。
// 画面に依存しない判定だけを置く。決められないときは null を返し、推測で表紙やリンクを付けない。

export type Candidate = { id: number; native: string; status: string; cover: string };

// 記号・空白をそろえ、期数の書き方（第2期・Season2・シーズン２・末尾の「2」）を「s2」にそろえる
export function programKey(s: string): string {
  let t = (s || "").normalize("NFKC").toLowerCase();
  t = t.replace(/\s*[(（]\d{4}[)）]\s*$/, ""); // AniList が同名作品を区別する「(2023)」
  t = t.replace(/[\s　]/g, "").replace(/[～〜~！!？?・、。「」『』（）()【】]/g, "");
  t = t.replace(/第?(\d+)期|season(\d+)|(\d+)(?:st|nd|rd|th)season|シーズン(\d+)/g, (_, a, b, c, d) => `s${a || b || c || d}`);
  t = t.replace(/([^\d.s])([2-9])$/, "$1s$2"); // 「…同好会 2」のように末尾の数字だけで期数を表すもの
  return t;
}

// AniList で探すときの検索語：期数・クール・かっこ書きを外した作品名
export function searchBase(title: string): string {
  const t = (title || "")
    .normalize("NFKC")
    .replace(/[(（][^)）]*[)）]/g, " ")
    .replace(/\s*(第\s*\d+\s*期|season\s*\d+|\d+(st|nd|rd|th)\s*season|シーズン\s*\d+|第\s*\d+\s*クール).*$/i, "")
    .trim();
  return t || title;
}

export function pickWork(programTitle: string, candidates: Candidate[]): Candidate | null {
  const key = programKey(programTitle);
  if (!key) return null;
  const uniq = [...new Map(candidates.map((c) => [c.id, c])).values()];
  const exact = uniq.filter((c) => programKey(c.native) === key);
  if (exact.length === 0) return null;
  // いま放送している番組なので、同じ題名のうち放送中の作品が1つだけならそれ（ポケットモンスターの新シリーズなど）
  const airing = exact.filter((c) => c.status === "RELEASING");
  if (airing.length === 1) return airing[0];
  // 同じ題名で始まる作品が放送中なら、新しいシリーズの可能性があるので決めない
  if (uniq.some((c) => c.status === "RELEASING" && !exact.includes(c) && programKey(c.native).startsWith(key))) return null;
  if (exact.length === 1) return exact[0];
  // 記号だけ違う作品が並ぶとき（銀魂 と 銀魂。）は、番組表と文字まで同じものが1つだけならそれ
  const same = exact.filter((c) => c.native.normalize("NFKC").replace(/\s/g, "") === programTitle.normalize("NFKC").replace(/\s/g, ""));
  return same.length === 1 ? same[0] : null;
}
