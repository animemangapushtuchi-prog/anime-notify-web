import { redirect } from "next/navigation";
import { latestSeasonKeyWithData } from "@/lib/seasonStreaming";

// 1時間ごとに再計算（新シーズンのデータを公開したら自動で切り替わる）
export const revalidate = 3600;

// /streaming は「公開データがある最新シーズン」へ。
// 日付だけで今期に飛ばすと、季節の変わり目にデータ未投入の空ページへ
// 飛んでしまうため（配信各社のラインナップ公開はクール開始の2〜3週間前）。
export default async function StreamingIndex() {
  const key = await latestSeasonKeyWithData();
  redirect(`/streaming/${key}`);
}
