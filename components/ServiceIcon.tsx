// 配信サービスの色アイコン（ブランド色＋頭文字を自前描画）。Flutter版のserviceIcon相当。
export default function ServiceIcon({ name, size = 20 }: { name: string; size?: number }) {
  const s = name.toLowerCase();
  let color = "#5B4FCF";
  let label = name ? name[0].toUpperCase() : "?";
  if (s.includes("netflix")) {
    color = "#E50914";
    label = "N";
  } else if (s.includes("prime") || s === "amazon") {
    color = "#00A8E1";
    label = "P";
  } else if (s.includes("u-next") || s.includes("unext")) {
    color = "#0A5DC2";
    label = "U";
  } else if (s.includes("d anime") || s.includes("danime") || s.includes("dアニメ")) {
    color = "#EB5505";
    label = "d";
  } else if (s.includes("youtube")) {
    color = "#FF0000";
    label = "▶";
  } else if (s.includes("abema")) {
    color = "#00B140";
    label = "A";
  } else if (s.includes("hulu")) {
    color = "#1CE783";
    label = "h";
  } else if (s.includes("disney")) {
    color = "#113CCF";
    label = "D";
  } else if (s.includes("niconico")) {
    color = "#444444";
    label = "n";
  } else if (s.includes("lemino")) {
    color = "#E5006D";
    label = "L";
  } else if (s.includes("bandai") || s.includes("バンダイ")) {
    color = "#E60012";
    label = "B";
  } else if (s.includes("fod")) {
    color = "#00B9F1";
    label = "F";
  }
  return (
    <span
      style={{ width: size, height: size, backgroundColor: color }}
      className="inline-flex flex-none items-center justify-center rounded-[5px] text-[11px] font-extrabold leading-none text-white"
      title={name}
    >
      {label}
    </span>
  );
}
