import { NextResponse } from "next/server";

// しょぼいカレンダーの番組表を、サーバー経由でまとめて取得する。
// ・Functions側(fetchTvAndSave)と同じ rss2.php?alt=json 形式を使う（実績のある形式）
// ・利用ルールに従い固有User-Agentを名乗る
// ・管理画面の「候補を更新」からの低頻度アクセスのみを想定（一般ページからは呼ばない）
// ・返すのは番組の最小項目だけ
const UA = "AnimeNotifyApp/1.0 (contact: animemangapushtuchi@gmail.com)";

export const dynamic = "force-dynamic";

type Item = {
  pid: number;
  tid: number;
  title: string;
  count: number | null;
  stTime: number;
  chName: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // days: 取得日数（1〜92）。今期ぶんを拾うため既定は広めに取る。
  const days = Math.min(Math.max(Number(searchParams.get("days") ?? 31), 1), 92);

  try {
    const res = await fetch(`https://cal.syoboi.jp/rss2.php?alt=json&days=${days}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `syobocal ${res.status}` }, { status: 502 });
    }
    const json = await res.json();
    const items: Item[] = [];
    for (const p of (json?.items ?? []) as any[]) {
      if (p?.Deleted !== "0") continue;
      const st = Number(p?.StTime);
      if (!Number.isFinite(st)) continue;
      items.push({
        pid: Number(p?.PID ?? 0),
        tid: Number(p?.TID ?? 0),
        title: String(p?.Title ?? ""),
        count: p?.Count != null && p?.Count !== "" ? Number(p.Count) : null,
        stTime: st,
        chName: String(p?.ChName ?? ""),
      });
    }
    return NextResponse.json({ count: items.length, days, items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
