// アニミル！のマスコット（ミーアキャット）。装飾用途なので alt は空＋aria-hidden。
// 画像は /public/mascot/{pose}.png（背景透過）。高さ指定・幅autoでアスペクト維持。
export type MascotPose =
  | "stand"
  | "wave"
  | "device"
  | "point"
  | "sit"
  | "surprised"
  | "cheer"
  | "worried";

export default function Mascot({
  pose,
  h = 120,
  className = "",
}: {
  pose: MascotPose;
  h?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/mascot/${pose}.png`}
      alt=""
      aria-hidden="true"
      className={className}
      style={{ height: h, width: "auto" }}
    />
  );
}
