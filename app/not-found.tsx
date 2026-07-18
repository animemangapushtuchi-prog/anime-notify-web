import Link from "next/link";
import Mascot from "@/components/Mascot";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <Mascot pose="worried" h={150} />
      <h1 className="text-xl font-extrabold text-[#1C1C2E]">ページが見つかりません</h1>
      <p className="text-sm text-[#6B7280]">
        お探しのページは移動または削除された可能性があります。
      </p>
      <Link
        href="/"
        className="rounded-full bg-[#C2772A] px-5 py-2.5 text-sm font-bold text-white"
      >
        ホームに戻る
      </Link>
    </main>
  );
}
