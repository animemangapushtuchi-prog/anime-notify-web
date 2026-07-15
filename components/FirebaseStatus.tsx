"use client";

// Phase 0 の動作確認用：ブラウザ側で Firebase が初期化できているかを表示するだけ。
// 認証やデータ読み込みはまだ行わない（権限エラーを避けるため）。
import { app } from "@/lib/firebase";

export default function FirebaseStatus() {
  const projectId = app.options.projectId;
  return (
    <div className="mt-8 rounded-xl border border-[#ECECF2] bg-white/60 px-4 py-3 text-sm">
      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 align-middle" />
      Firebase 接続OK
      <span className="ml-2 text-black/50">project: {projectId}</span>
    </div>
  );
}
