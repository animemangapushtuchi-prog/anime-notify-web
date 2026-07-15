"use client";

// ホーム上部のベータ版アンケート導線カード。回答済み(localStorage)または「あとで」で非表示。
import { useEffect, useState } from "react";
import Link from "next/link";

export default function SurveyCard() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem("surveyed") !== "1") setShow(true);
    } catch {
      setShow(true);
    }
  }, []);
  if (!show) return null;
  return (
    <div className="mb-4 rounded-2xl border border-[#E4DBFB] bg-[#F3EEFF] p-4">
      <p className="text-sm font-bold text-[#1C1C2E]">📝 ベータ版アンケートにご協力ください</p>
      <p className="mt-1 text-xs text-black/60">
        匿名・1分で終わります。感想が次のアップデートに直結します。
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Link
          href="/survey"
          className="flex-1 rounded-xl bg-[#5B4FCF] py-2.5 text-center text-sm font-bold text-white"
        >
          答える
        </Link>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="px-2 text-sm font-bold text-black/50"
        >
          あとで
        </button>
      </div>
    </div>
  );
}
