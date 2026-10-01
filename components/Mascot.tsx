// アニミル！のマスコット（ミーアキャット）。装飾用途なので alt は空＋aria-hidden。
// 画像は /public/mascot/w/{pose}.webp（背景透過・軽量版。元の PNG は /public/mascot/{pose}.png）。
// 高さ指定・幅autoでアスペクト維持。
export type MascotPose =
  | "stand"
  | "wave"
  | "device"
  | "point"
  | "sit"
  | "surprised"
  | "cheer"
  | "worried"
  | "thumbsup"
  | "sleep"
  | "face"
  | "search";

export default function Mascot({
  pose,
  h = 120,
  className = "",
  eager = false,
}: {
  pose: MascotPose;
  h?: number;
  className?: string;
  eager?: boolean; // 画面の最初に見える位置なら true（遅延読み込みしない）
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/mascot/w/${pose}.webp`}
      alt=""
      aria-hidden="true"
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className}
      style={{ height: h, width: "auto" }}
    />
  );
}
