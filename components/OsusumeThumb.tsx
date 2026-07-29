// 記事カードのサムネイル。画像が無い記事でも「何の記事か」が一目で伝わるように、
// サービス色＋見出し文字＋要点（数字）を自前で描く。画像素材が不要なので記事追加が軽い。
export type ThumbSpec = {
  label: string; // 大きく出す主題（例: "dアニメストア"）
  sub?: string; // 補助（例: "2026年夏アニメ"）
  stat?: string; // 数字などの要点（例: "38作品"）
  color?: string; // 背景色（サービスのブランド色）
};

const DEFAULT_BG = "#C2772A";

export default function OsusumeThumb({
  spec,
  className = "",
}: {
  spec: ThumbSpec;
  className?: string;
}) {
  const bg = spec.color || DEFAULT_BG;
  return (
    <div
      className={`relative flex flex-col justify-center overflow-hidden px-5 py-4 ${className}`}
      style={{ background: bg }}
    >
      {/* 背景の装飾（薄い円）。画像を使わずに単調さを避ける */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full"
        style={{ background: "rgba(255,255,255,0.10)" }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -left-4 h-24 w-24 rounded-full"
        style={{ background: "rgba(255,255,255,0.08)" }}
      />

      {spec.sub && (
        <p className="relative text-[11px] font-bold tracking-wide text-white/80">{spec.sub}</p>
      )}
      <p className="relative mt-0.5 text-[22px] font-black leading-tight text-white drop-shadow-sm">
        {spec.label}
      </p>
      {spec.stat && (
        <p className="relative mt-1.5 inline-flex w-fit rounded-full bg-white/20 px-2.5 py-0.5 text-[12px] font-bold text-white">
          {spec.stat}
        </p>
      )}
    </div>
  );
}
