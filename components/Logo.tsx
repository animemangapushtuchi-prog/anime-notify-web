import Link from "next/link";

// ブランドロゴ：キャラの顔（丸アバター）＋「アニミル！」ワードマーク。
// 「！」は首輪の赤でアクセント。ヘッダー(sm)・サイドバー(md)で共用。
export default function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const face = size === "md" ? "h-9 w-9" : "h-8 w-8";
  const text = size === "md" ? "text-xl" : "text-lg";
  return (
    <Link href="/" className="flex items-center gap-2">
      <span
        className={`flex ${face} flex-none items-center justify-center overflow-hidden rounded-full bg-[#F6E9D5] ring-2 ring-[#E7C9A0]`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mascot/face.png"
          alt="アニミル！"
          className="h-full w-full scale-110 object-cover"
        />
      </span>
      <span className={`${text} font-extrabold tracking-tight text-[#C2772A]`}>
        アニミル<span className="text-[#C0392B]">！</span>
      </span>
    </Link>
  );
}
