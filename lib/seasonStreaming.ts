// 今期配信一覧の「公開用」共有データを読む。書き込みは管理者（認証済みサーバー処理）側のみ。
// 公開データ: seasonStreamingPublic/{seasonKey}（親メタ） / .../entries/{entryId}
// ※ candidate・rejected・管理メモ等は seasonStreamingAdmin 側に置き、公開側へはコピーしない。
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type Availability =
  | "included" // 見放題
  | "rental" // レンタル
  | "channel" // 追加チャンネル
  | "free" // 無料
  | "unknown";

// 一般公開して良い最小限のフィールドだけを持つ
export type PublicEntry = {
  id: string;
  anilistId: number;
  title: string;
  coverImage: string;
  serviceKey: string;
  serviceName: string;
  availability: Availability;
  firstAvailableAt: number | null; // UNIX秒
  weeklyDay: number | null; // 0=日 .. 6=土
  weeklyTime: string | null; // "23:30"
  isExclusive: boolean;
  isFastest: boolean;
  sourceUrl: string;
  sourceCheckedAt: number | null; // UNIX秒
};

export type SeasonMeta = {
  seasonKey: string;
  label: string;
  confirmedCount: number;
  lastPublishedAt: number | null; // UNIX秒
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function toSec(v: any): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v.seconds === "number") return v.seconds; // Firestore Timestamp(生)
  if (v && typeof v.toDate === "function") return Math.floor(v.toDate().getTime() / 1000);
  return null;
}

export async function getSeasonMeta(seasonKey: string): Promise<SeasonMeta | null> {
  try {
    const snap = await getDoc(doc(db, "seasonStreamingPublic", seasonKey));
    if (!snap.exists()) return null;
    const d = snap.data() as any;
    return {
      seasonKey,
      label: String(d.label ?? ""),
      confirmedCount: Number(d.confirmedCount ?? d.entryCount ?? 0),
      lastPublishedAt: toSec(d.lastPublishedAt ?? d.updatedAt),
    };
  } catch {
    return null;
  }
}

// 公開エントリー（＝confirmed & published のみが書かれている想定）を全件取得
export async function getPublishedEntries(seasonKey: string): Promise<PublicEntry[]> {
  try {
    const col = collection(db, "seasonStreamingPublic", seasonKey, "entries");
    const snap = await getDocs(col);
    const out: PublicEntry[] = [];
    for (const s of snap.docs) {
      const d = s.data() as any;
      if (!d || typeof d.anilistId !== "number" || !d.serviceKey) continue;
      out.push({
        id: s.id,
        anilistId: d.anilistId,
        title: String(d.title ?? ""),
        coverImage: String(d.coverImage ?? ""),
        serviceKey: String(d.serviceKey),
        serviceName: String(d.serviceName ?? ""),
        availability: (d.availability ?? "unknown") as Availability,
        firstAvailableAt: toSec(d.firstAvailableAt),
        weeklyDay: typeof d.weeklyDay === "number" ? d.weeklyDay : null,
        weeklyTime: typeof d.weeklyTime === "string" ? d.weeklyTime : null,
        isExclusive: d.isExclusive === true,
        isFastest: d.isFastest === true,
        sourceUrl: String(d.sourceUrl ?? ""),
        sourceCheckedAt: toSec(d.sourceCheckedAt),
      });
    }
    return out;
  } catch {
    return [];
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const AVAILABILITY_JA: Record<Availability, string> = {
  included: "見放題",
  rental: "レンタル",
  channel: "追加チャンネル",
  free: "無料",
  unknown: "",
};

const WD = ["日", "月", "火", "水", "木", "金", "土"];
export function weeklyLabel(day: number | null, time: string | null): string | null {
  if (day == null) return null;
  return `毎週${WD[day] ?? ""}曜${time ? " " + time : ""}`;
}
