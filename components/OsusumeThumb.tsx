// 記事カードのサムネイル。作品のカバー画像を背景に敷き、その上に主題を大きく出す。
// 画像が用意できない記事でも、サービス色＋文字だけで成立するようにフォールバックする。
export type ThumbSpec = {
  label: string; // 大きく出す主題（例: "dアニメストア"）
  sub?: string; // 補助（例: "2026年夏アニメ"）
  stat?: string; // 数字などの要点（例: "38作品"）
  color?: string; // 背景色（サービスのブランド色）
  workIds?: number[]; // 背景に使う作品（AniList ID）
};

const DEFAULT_BG = "#C2772A";

export default function OsusumeThumb({
  spec,
  images = [],
  className = "",
}: {
  spec: ThumbSpec;
  images?: string[]; // 解決済みのカバー画像URL
  className?: string;
}) {
  const bg = spec.color || DEFAULT_BG;
  const pics = images.filter(Boolean).slice(0, 5);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: bg }}>
      {/* 背景：作品カバーを並べる */}
      {pics.length > 0 && (
        <div className="absolute inset-0 flex">
          {pics.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt=""
              aria-hidden="true"
              className="h-full flex-1 object-cover"
            />
          ))}
        </div>
      )}

      {/* 文字を読ませるための覆い。画像が無いときは装飾の円を出す */}
      {pics.length > 0 ? (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, ${bg}F2 0%, ${bg}D9 55%, ${bg}66 100%)`,
          }}
        />
      ) : (
        <>
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
        </>
      )}

      <div className="relative flex h-full flex-col justify-center px-5 py-4">
        {spec.sub && (
          <p className="text-[11px] font-bold tracking-wide text-white/85 drop-shadow">{spec.sub}</p>
        )}
        <p className="mt-0.5 text-[22px] font-black leading-tight text-white drop-shadow-md">
          {spec.label}
        </p>
        {spec.stat && (
          <p className="mt-1.5 inline-flex w-fit rounded-full bg-black/25 px-2.5 py-0.5 text-[12px] font-bold text-white backdrop-blur-sm">
            {spec.stat}
          </p>
        )}
      </div>
    </div>
  );
}
