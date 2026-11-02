// 来期の放送予定の日付の扱い（JSON を読まないのでテストから直接呼べる）
const WD = ["日", "月", "火", "水", "木", "金", "土"];

// "2027-01-10" → 「2027年1月10日（日）」、"2027-01" → 「2027年1月」
export function startLabel(start: string): string {
  const [y, m, d] = start.split("-").map(Number);
  if (!d) return `${y}年${m}月`;
  return `${y}年${m}月${d}日（${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}）`;
}

// まだ始まっていない作品か。月だけのときは、その月の終わりまで「これから」として扱う
export function isBeforeStart(start: string, nowSec: number): boolean {
  const [y, m, d] = start.split("-").map(Number);
  const end = d ? Date.UTC(y, m - 1, d) : Date.UTC(y, m, 1);
  return nowSec < end / 1000 - 9 * 3600;
}
