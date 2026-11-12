// アクセス計測の送信口（2026-11-12〜）。個人を特定する情報やアドレスそのものは送らず、決まった分類名だけ送る。
// 受け口は Functions の pv（別リポジトリ functions/index.js）。受け口側でも同じ分類だけを受け付ける。
//
// 何を数えるか：
// - 表示（PV）と、その日初めての訪問（UV）。UV には「初めて来た人／前にも来た人」を付ける
// - 読んだ訪問：画面を動かす・押す、または15秒とどまった訪問（巡回プログラムを数えないための、より確かな数）
// - 行動：作品を登録した（reg）、通知をオンにした（push）、配信サービスへ移動した（out）、絞り込みを使った（filter）
// - ページごとの数（k）。作品ページなら「work:123」の形

const PV_URL = "https://asia-northeast1-anime-notify-app-86ccc.cloudfunctions.net/pv";
const PROD_HOST = "www.animiru.com";
// 名乗っている巡回プログラム（検索エンジン・表示速度の検査など）は数えない
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|preview|monitor/i;

// 受け口（Functions の pv）を 2026-11-12 の版に入れ替えるまでは false にしておく。
// 古い受け口は ev つきの通知も「表示1回」と数えてしまうため。入れ替えたら true にする（docs/HANDOFF.md §9）
const SERVER_READY = false;

export type TrackEvent = "reg" | "push" | "filter";

const KINDS = [
  "work", "streaming", "osusume", "search", "calendar", "me", "notifications",
  "settings", "login", "guide", "survey", "terms", "privacy",
];

// ページの種類（Functions 側も同じ一覧だけを受け付ける）
export function pageKind(path: string): string {
  if (path === "/") return "top";
  const first = path.split("/")[1] ?? "";
  return KINDS.includes(first) ? first : "other";
}

// ページごとの数に使うキー：「/work/123」→「work:123」、「/streaming/2026-fall/netflix」→「streaming:2026-fall:netflix」
// 作品・配信一覧・記事だけ細かく分け、ほかは種類だけにする
export function pathKey(path: string): string {
  const seg = path.split("/").filter(Boolean).map((s) => s.toLowerCase());
  const kind = pageKind(path);
  if (kind === "top" || kind === "other") return kind;
  const ok = (s: string | undefined) => !!s && /^[a-z0-9_-]{1,40}$/.test(s);
  if (kind === "work") return /^\d{1,8}$/.test(seg[1] ?? "") ? `work:${seg[1]}` : "work";
  if (kind === "streaming") return ["streaming", ...seg.slice(1, 3).filter(ok)].join(":");
  if (kind === "osusume") return ok(seg[1]) ? `osusume:${seg[1]}` : "osusume";
  return kind;
}

// 配信サービスへのリンクかどうか（押された回数を数える）
const SERVICE_HOSTS: [RegExp, string][] = [
  [/(^|\.)animestore\.docomo\.ne\.jp$/, "d-anime"],
  [/(^|\.)lemino\.docomo\.ne\.jp$/, "lemino"],
  [/(^|\.)abema\.tv$/, "abema"],
  [/(^|\.)netflix\.com$/, "netflix"],
  [/(^|\.)amazon\.co\.jp$/, "prime-video"],
  [/(^|\.)unext\.jp$/, "u-next"],
  [/(^|\.)hulu\.jp$/, "hulu"],
  [/(^|\.)fod\.fujitv\.co\.jp$/, "fod"],
  [/(^|\.)dmm\.com$/, "dmm-tv"],
  [/(^|\.)telasa\.jp$/, "telasa"],
  [/(^|\.)disneyplus\.com$/, "disney-plus"],
  [/(^|\.)nicovideo\.jp$/, "niconico"],
  [/(^|\.)b-ch\.com$/, "bandai-channel"],
];
export function serviceOfUrl(href: string): string | null {
  let host = "";
  try {
    host = new URL(href).hostname;
  } catch {
    return null;
  }
  return SERVICE_HOSTS.find(([re]) => re.test(host))?.[1] ?? null;
}

// どこから来たか（document.referrer のドメインを分類名にする）
export function refKindOf(ref: string): string {
  if (!ref) return "direct";
  let host = "";
  try {
    host = new URL(ref).hostname;
  } catch {
    return "other";
  }
  if (host.endsWith("animiru.com")) return "internal";
  if (/(^|\.)google\./.test(host)) return "google";
  if (/(^|\.)yahoo\.(co\.jp|com)$/.test(host)) return "yahoo";
  if (/(^|\.)bing\.com$/.test(host)) return "bing";
  if (/(^|\.)(t\.co|x\.com|twitter\.com)$/.test(host)) return "x";
  if (/(^|\.)(line\.me|facebook\.com|instagram\.com|threads\.net|youtube\.com|reddit\.com)$/.test(host)) return "sns";
  return "other";
}

// 日本時間の今日（"2026-11-12"）
export function jstToday(now = Date.now()): string {
  return new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// 初めて来た人か、前にも来た人か。初めて来た日をこの端末のブラウザに覚えておく（サーバーには送らない）
export function visitorKind(store: Pick<Storage, "getItem" | "setItem">, today: string): "new" | "back" {
  const first = store.getItem("firstSeen");
  if (first) return first === today ? "new" : "back";
  // 以前の計測（uvDate）だけ残っている人は、その日を「初めて来た日」とみなす
  const before = store.getItem("uvDate");
  const seen = before && before < today ? before : today;
  store.setItem("firstSeen", seen);
  return seen === today ? "new" : "back";
}

// 計測してよい環境か：本番だけ。自動操作のブラウザ・巡回プログラム・管理画面は数えない
export function canTrack(): boolean {
  try {
    return (
      window.location.hostname === PROD_HOST &&
      !navigator.webdriver &&
      !BOT_UA.test(navigator.userAgent) &&
      !window.location.pathname.startsWith("/admin")
    );
  } catch {
    return false;
  }
}

export function send(params: Record<string, string>): void {
  try {
    if (!canTrack()) return;
    if (params.ev && !SERVER_READY) return;
    const url = `${PV_URL}?${new URLSearchParams(params).toString()}`;
    if (navigator.sendBeacon) navigator.sendBeacon(url);
    else fetch(url, { method: "POST", keepalive: true }).catch(() => {});
  } catch {
    /* 計測の失敗で画面を止めない */
  }
}

export function trackEvent(ev: TrackEvent): void {
  send({ ev });
}
