// 今期配信データの管理用（候補の確認・補正・公開）。書き込みはログイン中の管理者UIDのみ。
// 管理用: seasonStreamingAdmin/{seasonKey}/entries/{entryId}（candidate等も保持）
// 公開用: seasonStreamingPublic/{seasonKey}/entries/{entryId}（confirmed & published のみ同期）
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { serviceNameOf, STREAM_SERVICES } from "@/lib/streaming";
import { seasonInfo } from "@/lib/season";
import type { Availability } from "@/lib/seasonStreaming";

// 管理者UID（カンマ区切り可）。値はコードに直書きせず環境変数で設定する。
const ADMIN_UIDS = (process.env.NEXT_PUBLIC_ADMIN_UIDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const isAdminUid = (uid: string | null | undefined): boolean =>
  !!uid && ADMIN_UIDS.includes(uid);

export const adminConfigured = ADMIN_UIDS.length > 0;

export type EntryStatus = "candidate" | "confirmed" | "rejected" | "unknown";
export type SourceType = "official-lineup" | "anilist" | "syobocal" | "manual";

export type AdminEntry = {
  id: string; // {anilistId}_{serviceKey}
  anilistId: number;
  title: string;
  titleNormalized?: string;
  coverImage: string;
  serviceKey: string;
  serviceName: string;
  status: EntryStatus;
  availability: Availability;
  firstAvailableAt: number | null;
  weeklyDay: number | null;
  weeklyTime: string | null;
  episode: number | null;
  isExclusive: boolean;
  isFastest: boolean;
  sourceType: SourceType;
  sourceUrl: string;
  sourceLabel: string;
  sourceCheckedAt: number | null;
  confidence: "high" | "medium" | "low";
  note: string;
  published: boolean;
};

export const entryId = (anilistId: number, serviceKey: string) => `${anilistId}_${serviceKey}`;

// 自動で confirmed にしてはいけないサービス（公式一覧が前提にできないため必ず人の確認を挟む）
export const MANUAL_ONLY_SERVICES = ["prime-video", "netflix"];

/* eslint-disable @typescript-eslint/no-explicit-any */
function toSec(v: any): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v.seconds === "number") return v.seconds;
  if (v && typeof v.toDate === "function") return Math.floor(v.toDate().getTime() / 1000);
  return null;
}

function fromDoc(id: string, d: any): AdminEntry {
  return {
    id,
    anilistId: Number(d.anilistId ?? 0),
    title: String(d.title ?? ""),
    titleNormalized: d.titleNormalized ? String(d.titleNormalized) : undefined,
    coverImage: String(d.coverImage ?? ""),
    serviceKey: String(d.serviceKey ?? ""),
    serviceName: String(d.serviceName ?? serviceNameOf(String(d.serviceKey ?? ""))),
    status: (d.status ?? "candidate") as EntryStatus,
    availability: (d.availability ?? "unknown") as Availability,
    firstAvailableAt: toSec(d.firstAvailableAt),
    weeklyDay: typeof d.weeklyDay === "number" ? d.weeklyDay : null,
    weeklyTime: typeof d.weeklyTime === "string" ? d.weeklyTime : null,
    episode: typeof d.episode === "number" ? d.episode : null,
    isExclusive: d.isExclusive === true,
    isFastest: d.isFastest === true,
    sourceType: (d.sourceType ?? "manual") as SourceType,
    sourceUrl: String(d.sourceUrl ?? ""),
    sourceLabel: String(d.sourceLabel ?? ""),
    sourceCheckedAt: toSec(d.sourceCheckedAt),
    confidence: (d.confidence ?? "medium") as "high" | "medium" | "low",
    note: String(d.note ?? ""),
    published: d.published === true,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listAdminEntries(seasonKey: string): Promise<AdminEntry[]> {
  const snap = await getDocs(collection(db, "seasonStreamingAdmin", seasonKey, "entries"));
  return snap.docs.map((s) => fromDoc(s.id, s.data()));
}

// undefined を Firestore に保存しないため、値を明示的に整えて書く
function toAdminDoc(e: AdminEntry) {
  return {
    anilistId: e.anilistId,
    title: e.title,
    titleNormalized: e.titleNormalized ?? "",
    coverImage: e.coverImage ?? "",
    serviceKey: e.serviceKey,
    serviceName: e.serviceName || serviceNameOf(e.serviceKey),
    status: e.status,
    availability: e.availability,
    firstAvailableAt: e.firstAvailableAt,
    weeklyDay: e.weeklyDay,
    weeklyTime: e.weeklyTime,
    episode: e.episode,
    isExclusive: !!e.isExclusive,
    isFastest: !!e.isFastest,
    sourceType: e.sourceType,
    sourceUrl: e.sourceUrl ?? "",
    sourceLabel: e.sourceLabel ?? "",
    sourceCheckedAt: e.sourceCheckedAt,
    confidence: e.confidence,
    note: e.note ?? "",
    published: !!e.published,
    updatedAt: serverTimestamp(),
  };
}

// 公開側には一般に見せてよい最小限だけを書く（note/confidence/status等はコピーしない）
function toPublicDoc(e: AdminEntry) {
  return {
    anilistId: e.anilistId,
    title: e.title,
    coverImage: e.coverImage ?? "",
    serviceKey: e.serviceKey,
    serviceName: e.serviceName || serviceNameOf(e.serviceKey),
    availability: e.availability,
    firstAvailableAt: e.firstAvailableAt,
    weeklyDay: e.weeklyDay,
    weeklyTime: e.weeklyTime,
    isExclusive: !!e.isExclusive,
    isFastest: !!e.isFastest,
    sourceUrl: e.sourceUrl ?? "",
    sourceCheckedAt: e.sourceCheckedAt,
    updatedAt: serverTimestamp(),
  };
}

export function validateForConfirm(e: AdminEntry): string | null {
  if (e.status !== "confirmed") return null;
  if (!e.sourceUrl.trim()) return "確認済みにするには出典URLが必要です";
  if (!/^https?:\/\//.test(e.sourceUrl.trim())) return "出典URLは http(s):// で始まる必要があります";
  return null;
}

// 1件保存：管理側を更新し、公開条件を満たすかで公開側を作成/削除する
export async function saveEntry(seasonKey: string, e: AdminEntry): Promise<void> {
  const err = validateForConfirm(e);
  if (err) throw new Error(err);
  const id = e.id || entryId(e.anilistId, e.serviceKey);
  await setDoc(doc(db, "seasonStreamingAdmin", seasonKey, "entries", id), toAdminDoc(e), {
    merge: true,
  });
  const pubRef = doc(db, "seasonStreamingPublic", seasonKey, "entries", id);
  if (e.status === "confirmed" && e.published) {
    await setDoc(pubRef, toPublicDoc(e), { merge: true });
  } else {
    await deleteDoc(pubRef).catch(() => {});
  }
  await refreshSeasonMeta(seasonKey);
}

// 複数保存（500件ごとにバッチ分割）
export async function saveEntries(seasonKey: string, list: AdminEntry[]): Promise<void> {
  for (const e of list) {
    const err = validateForConfirm(e);
    if (err) throw new Error(`${e.title}（${e.serviceName}）: ${err}`);
  }
  const CH = 200;
  for (let i = 0; i < list.length; i += CH) {
    const batch = writeBatch(db);
    for (const e of list.slice(i, i + CH)) {
      const id = e.id || entryId(e.anilistId, e.serviceKey);
      batch.set(doc(db, "seasonStreamingAdmin", seasonKey, "entries", id), toAdminDoc(e), {
        merge: true,
      });
      const pubRef = doc(db, "seasonStreamingPublic", seasonKey, "entries", id);
      if (e.status === "confirmed" && e.published) batch.set(pubRef, toPublicDoc(e), { merge: true });
      else batch.delete(pubRef);
    }
    await batch.commit();
  }
  await refreshSeasonMeta(seasonKey);
}

// 公開件数などの親メタを更新（公開ページの「最終確認日」に使う）
export async function refreshSeasonMeta(seasonKey: string): Promise<void> {
  const info = seasonInfo(seasonKey);
  const pub = await getDocs(collection(db, "seasonStreamingPublic", seasonKey, "entries"));
  await setDoc(
    doc(db, "seasonStreamingPublic", seasonKey),
    {
      seasonKey,
      year: info.year,
      season: info.season,
      label: info.label,
      confirmedCount: pub.size,
      lastPublishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// 取り込み（貼り付け）。既存の confirmed / rejected / メモ / 公開設定は壊さない。
export type ImportRow = {
  anilistId: number;
  title: string;
  serviceKey: string;
  coverImage?: string;
  availability?: Availability;
  firstAvailableAt?: number | null;
  weeklyDay?: number | null;
  weeklyTime?: string | null;
  isExclusive?: boolean;
  isFastest?: boolean;
  sourceUrl?: string;
  sourceLabel?: string;
  sourceType?: SourceType;
};

export type ImportResult = { added: number; updated: number; skipped: number; errors: string[] };

export function parseImport(text: string): { rows: ImportRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: ImportRow[] = [];
  const t = text.trim();
  if (!t) return { rows, errors: ["入力が空です"] };

  const known = new Set(STREAM_SERVICES.map((s) => s.key));
  const pushRow = (r: Partial<ImportRow>, where: string) => {
    const id = Number(r.anilistId);
    const key = String(r.serviceKey ?? "").trim();
    if (!Number.isFinite(id) || id <= 0) return errors.push(`${where}: anilistId が不正`);
    if (!known.has(key)) return errors.push(`${where}: serviceKey「${key}」は未対応`);
    rows.push({
      anilistId: id,
      title: String(r.title ?? "").trim(),
      serviceKey: key,
      coverImage: r.coverImage ? String(r.coverImage) : "",
      availability: (r.availability ?? "unknown") as Availability,
      firstAvailableAt: r.firstAvailableAt ?? null,
      weeklyDay: r.weeklyDay ?? null,
      weeklyTime: r.weeklyTime ?? null,
      isExclusive: !!r.isExclusive,
      isFastest: !!r.isFastest,
      sourceUrl: r.sourceUrl ? String(r.sourceUrl) : "",
      sourceLabel: r.sourceLabel ? String(r.sourceLabel) : "",
      sourceType: (r.sourceType ?? "manual") as SourceType,
    });
  };

  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      const parsed = JSON.parse(t);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      arr.forEach((r, i) => pushRow(r, `JSON[${i}]`));
    } catch {
      errors.push("JSONとして解釈できませんでした");
    }
    return { rows, errors };
  }

  // CSV: anilistId,title,serviceKey,availability,firstAvailableAt(YYYY-MM-DD),weeklyDay,weeklyTime,sourceUrl
  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  lines.forEach((line, i) => {
    if (i === 0 && /anilistid/i.test(line)) return; // ヘッダ行
    const c = line.split(",").map((s) => s.trim());
    const dateSec = c[4] ? Math.floor(new Date(`${c[4]}T00:00:00+09:00`).getTime() / 1000) : null;
    pushRow(
      {
        anilistId: Number(c[0]),
        title: c[1],
        serviceKey: c[2],
        availability: (c[3] || "unknown") as Availability,
        firstAvailableAt: Number.isFinite(dateSec as number) ? dateSec : null,
        weeklyDay: c[5] === "" || c[5] == null ? null : Number(c[5]),
        weeklyTime: c[6] || null,
        sourceUrl: c[7] || "",
        sourceType: "manual",
      },
      `${i + 1}行目`
    );
  });
  return { rows, errors };
}

// 取り込み実行：新規は candidate、既存は confirmed/rejected/メモ/公開設定を保持したまま補完のみ
export async function applyImport(seasonKey: string, rows: ImportRow[]): Promise<ImportResult> {
  const res: ImportResult = { added: 0, updated: 0, skipped: 0, errors: [] };
  for (const r of rows) {
    const id = entryId(r.anilistId, r.serviceKey);
    const ref = doc(db, "seasonStreamingAdmin", seasonKey, "entries", id);
    const cur = await getDoc(ref);
    if (!cur.exists()) {
      await setDoc(ref, {
        anilistId: r.anilistId,
        title: r.title,
        titleNormalized: "",
        coverImage: r.coverImage ?? "",
        serviceKey: r.serviceKey,
        serviceName: serviceNameOf(r.serviceKey),
        status: "candidate",
        availability: r.availability ?? "unknown",
        firstAvailableAt: r.firstAvailableAt ?? null,
        weeklyDay: r.weeklyDay ?? null,
        weeklyTime: r.weeklyTime ?? null,
        episode: null,
        isExclusive: !!r.isExclusive,
        isFastest: !!r.isFastest,
        sourceType: r.sourceType ?? "manual",
        sourceUrl: r.sourceUrl ?? "",
        sourceLabel: r.sourceLabel ?? "",
        sourceCheckedAt: null,
        confidence: "medium",
        note: "",
        published: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      res.added++;
      continue;
    }
    const d = cur.data() as { status?: string };
    if (d.status === "rejected") {
      res.skipped++; // 却下済みは再インポートで復活させない
      continue;
    }
    // 既存は「空欄の補完」だけ行い、確認済みの内容や公開設定を上書きしない
    const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
    const cd = cur.data() as Record<string, unknown>;
    if (!cd.title && r.title) patch.title = r.title;
    if (!cd.coverImage && r.coverImage) patch.coverImage = r.coverImage;
    if (cd.firstAvailableAt == null && r.firstAvailableAt != null)
      patch.firstAvailableAt = r.firstAvailableAt;
    if (cd.weeklyDay == null && r.weeklyDay != null) patch.weeklyDay = r.weeklyDay;
    if (!cd.weeklyTime && r.weeklyTime) patch.weeklyTime = r.weeklyTime;
    if (!cd.sourceUrl && r.sourceUrl) patch.sourceUrl = r.sourceUrl;
    if (Object.keys(patch).length > 1) {
      await setDoc(ref, patch, { merge: true });
      res.updated++;
    } else {
      res.skipped++;
    }
  }
  return res;
}
