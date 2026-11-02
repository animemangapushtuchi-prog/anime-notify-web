// 「見たい作品を全部見るのに、いちばん安い配信サービスの組み合わせ」を計算する。画面に依存しない計算だけを置く。
// 配信先は確認済みのデータだけ。レンタル・追加チャンネルは月額に含まれないので、数えない。

export type PlanWork = { id: number; title: string; cover: string; services: string[] };
export type Prices = Record<string, number>; // サービスキー → 月額（円）

export type Plan = {
  services: string[]; // 契約するサービス（安い順）
  total: number; // 月額の合計
  covered: number; // 見られる作品の数
};

export type PlanResult = Plan & {
  missing: PlanWork[]; // どのサービスでも見られない作品（確認済みの配信先が無い、または料金未確認のサービスだけ）
};

const subsets = (keys: string[]): string[][] => {
  const out: string[][] = [];
  for (let bit = 1; bit < 1 << keys.length; bit++) out.push(keys.filter((_, i) => bit & (1 << i)));
  return out;
};

const byPrice = (list: string[], prices: Prices) => [...list].sort((a, b) => prices[a] - prices[b]);
const sum = (list: string[], prices: Prices) => list.reduce((n, k) => n + prices[k], 0);
const countCovered = (works: PlanWork[], set: Set<string>) => works.filter((w) => w.services.some((s) => set.has(s))).length;

// 選んだ作品をすべて（見られるものは全部）見るための、いちばん安い組み合わせ。
// サービスは11社ほどなので全通り試しても2,000通り程度で一瞬で終わる
export function cheapestPlan(works: PlanWork[], prices: Prices): PlanResult {
  const reachable = works.filter((w) => w.services.some((s) => prices[s] != null));
  const missing = works.filter((w) => !reachable.includes(w));
  const keys = [...new Set(reachable.flatMap((w) => w.services))].filter((k) => prices[k] != null);
  let best: Plan = { services: [], total: 0, covered: 0 };
  let found = false;
  for (const list of subsets(keys)) {
    const set = new Set(list);
    if (countCovered(reachable, set) < reachable.length) continue;
    const total = sum(list, prices);
    if (!found || total < best.total || (total === best.total && list.length < best.services.length)) {
      best = { services: byPrice(list, prices), total, covered: reachable.length };
      found = true;
    }
  }
  return { ...best, missing };
}

// 1社・2社・3社で、見られる作品がいちばん多い組み合わせ（同数なら安いほう）
export function bestBySize(works: PlanWork[], prices: Prices, size: number): Plan | null {
  const keys = Object.keys(prices).filter((k) => works.some((w) => w.services.includes(k)));
  let best: Plan | null = null;
  for (const list of subsets(keys)) {
    if (list.length !== size) continue;
    const covered = countCovered(works, new Set(list));
    const total = sum(list, prices);
    if (!best || covered > best.covered || (covered === best.covered && total < best.total)) {
      best = { services: byPrice(list, prices), total, covered };
    }
  }
  return best;
}

// 1社あたりの作品数（料金の表に出す）
export function coverage(works: PlanWork[], key: string): number {
  return works.filter((w) => w.services.includes(key)).length;
}
