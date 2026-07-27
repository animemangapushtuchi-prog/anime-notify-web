import { redirect } from "next/navigation";
import { currentSeasonKey } from "@/lib/season";

// /streaming は現在シーズンへ
export default function StreamingIndex() {
  redirect(`/streaming/${currentSeasonKey()}`);
}
