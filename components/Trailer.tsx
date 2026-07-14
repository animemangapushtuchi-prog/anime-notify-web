"use client";

// 公式PV。サムネイル＋再生ボタン→クリックで初めてYouTube iframeを読み込む（遅延ロード）。
import { useState } from "react";

export default function Trailer({
  videoId,
  thumb,
}: {
  videoId: string;
  thumb?: string | null;
}) {
  const [playing, setPlaying] = useState(false);
  const poster =
    thumb && thumb.length > 0
      ? thumb
      : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      {playing ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title="公式PV"
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 h-full w-full"
          aria-label="PVを再生"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster}
            alt="PVサムネイル"
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/35">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg">
              <span className="ml-1 border-y-[10px] border-l-[16px] border-y-transparent border-l-[#5B4FCF]" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
