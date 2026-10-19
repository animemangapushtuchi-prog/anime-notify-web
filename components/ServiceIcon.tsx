// 配信サービスのアイコン。
//
// 公式ロゴは各社の商標で、使うには各社の許可が必要（Netflix・Amazon は許可なしの使用を禁止、
// 国内各社は利用条件を公開していない）。そのため普段は、アニミル！が自分で描く「色＋短い文字」のアイコンを使う。
// 許可が取れた会社のロゴは public/service-logos/{サービスキー}.svg に置き、OFFICIAL_LOGOS に加えると自動で差し替わる。
// （許可の条件で大きさ・余白・背景などの決まりがあれば、それに合わせること）

type Def = { key: string; match: RegExp; color: string; label: string };

// 色は各社のイメージに近い色だが、ロゴそのものではない。文字が読めるよう、明るい色には濃い文字を使う
const DEFS: Def[] = [
  { key: "d-anime", match: /dアニメ|d\s?anime|danime/i, color: "#E8590C", label: "d" },
  { key: "abema", match: /abema|アベマ/i, color: "#1B8E3E", label: "A" },
  { key: "netflix", match: /netflix/i, color: "#D81F26", label: "N" },
  { key: "prime-video", match: /prime|amazon/i, color: "#1F7AE0", label: "P" },
  { key: "u-next", match: /u-?next/i, color: "#1E3A8A", label: "U" },
  { key: "hulu", match: /hulu/i, color: "#1CE783", label: "Hu" },
  { key: "fod", match: /fod/i, color: "#0A6CB8", label: "F" },
  { key: "dmm-tv", match: /dmm/i, color: "#2B2B2B", label: "DM" },
  { key: "lemino", match: /lemino/i, color: "#D6006A", label: "L" },
  { key: "telasa", match: /telasa/i, color: "#5B2C83", label: "T" },
  { key: "disney-plus", match: /disney/i, color: "#14327A", label: "D+" },
  { key: "anime-times", match: /アニメタイムズ|anime\s?times/i, color: "#F2B705", label: "AT" },
  { key: "niconico", match: /ニコニコ|niconico/i, color: "#3B3B3B", label: "ニ" },
  { key: "bandai-channel", match: /バンダイ|bandai/i, color: "#C8102E", label: "B" },
  { key: "youtube", match: /youtube/i, color: "#E62117", label: "▶" },
];

// 許可が取れて、public/service-logos/{key}.svg を置いた会社だけをここに足す（2026-10-19 時点で無し）
const OFFICIAL_LOGOS = new Set<string>([]);

// 背景色に対して読める文字色（明るい背景なら濃い文字）
function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? "#1A1523" : "#FFFFFF";
}

export function serviceDef(nameOrKey: string): Def {
  return (
    DEFS.find((d) => d.key === nameOrKey) ??
    DEFS.find((d) => d.match.test(nameOrKey)) ?? {
      key: "other",
      match: /./,
      color: "#8A5518",
      label: nameOrKey ? nameOrKey[0].toUpperCase() : "?",
    }
  );
}

export default function ServiceIcon({ name, size = 20 }: { name: string; size?: number }) {
  const d = serviceDef(name);
  if (OFFICIAL_LOGOS.has(d.key)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/service-logos/${d.key}.svg`} alt={name} width={size} height={size} className="flex-none rounded-[22%]" />
    );
  }
  const two = d.label.length > 1;
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      style={{
        width: size,
        height: size,
        backgroundColor: d.color,
        color: textOn(d.color),
        fontSize: Math.round(size * (two ? 0.4 : 0.52)),
      }}
      className="inline-flex flex-none select-none items-center justify-center rounded-[22%] font-extrabold leading-none tracking-tight shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
    >
      {d.label}
    </span>
  );
}
