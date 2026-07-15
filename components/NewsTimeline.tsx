// 公式情報の履歴タイムライン（左に丸ドット＋縦線）。いまはダミー。
// 将来は検知イベント（放送開始・配信入り・発表）から自動生成し差し替える。
type NewsItem = { date: string; title: string; category: string };

const DUMMY: NewsItem[] = [
  { date: "2024/07/15", title: "dアニメストアで配信開始", category: "配信入り" },
  { date: "2024/07/08", title: "第1話 放送開始", category: "放送開始" },
  { date: "2024/07/01", title: "放送日・放送局が決定", category: "放送日決定" },
  { date: "2024/04/02", title: "ティザーPV公開", category: "PV公開" },
  { date: "2024/01/10", title: "TVアニメ化決定", category: "アニメ化決定" },
];

function chipCls(c: string): string {
  switch (c) {
    case "アニメ化決定":
    case "発表":
      return "bg-[#F1E9FE] text-[#7C3AED]";
    case "PV公開":
      return "bg-[#FDEAEA] text-[#DC2626]";
    case "放送日決定":
    case "放送開始":
      return "bg-[#E8F0FE] text-[#2563EB]";
    case "配信入り":
    case "配信決定":
      return "bg-[#E6F7F1] text-[#059669]";
    default:
      return "bg-[#ECEAFD] text-[#5B4FCF]";
  }
}
function dotColor(c: string): string {
  switch (c) {
    case "アニメ化決定":
    case "発表":
      return "#7C3AED";
    case "PV公開":
      return "#DC2626";
    case "放送日決定":
    case "放送開始":
      return "#2563EB";
    case "配信入り":
    case "配信決定":
      return "#059669";
    default:
      return "#5B4FCF";
  }
}

export default function NewsTimeline() {
  return (
    <ol className="relative ml-1 border-l-2 border-[#ECECF2]">
      {DUMMY.map((it, i) => (
        <li key={i} className="relative pb-4 pl-4 last:pb-0">
          <span
            className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white"
            style={{ backgroundColor: dotColor(it.category) }}
          />
          <p className="text-[11px] text-[#6B7280]">{it.date}</p>
          <div className="mt-0.5 flex items-start gap-2">
            <span
              className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold ${chipCls(
                it.category
              )}`}
            >
              {it.category}
            </span>
            <span className="text-[13px] font-bold text-[#1C1C2E]">{it.title}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
