// 配信サービスの正規化と、しょぼいカレンダー由来のネット配信キャッシュ(cache/streamSchedule)の利用。
// Functions側の functions/lib/streaming.js と同じ正規化ルールを使う。
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isHiddenService } from "@/lib/anilist";
import { normTitle } from "@/lib/home";

export type StreamService = { key: string; name: string };

// 表記ゆれ → { key: 比較キー, name: 表示名 }。順序に意味あり（例:「dアニメストア ニコニコ支店」はdアニメ優先）
const SERVICE_DEFS: { key: string; name: string; re: RegExp }[] = [
  { key: "d-anime", name: "dアニメストア", re: /d\s?anime|danime|dアニメ/i },
  { key: "abema", name: "ABEMA", re: /abema|アベマ/i },
  { key: "netflix", name: "Netflix", re: /netflix|ネットフリックス/i },
  { key: "prime-video", name: "Prime Video", re: /prime|amazon|プライム/i },
  { key: "u-next", name: "U-NEXT", re: /u-?next/i },
  { key: "hulu", name: "Hulu", re: /hulu/i },
  { key: "fod", name: "FOD", re: /fod/i },
  { key: "dmm-tv", name: "DMM TV", re: /dmm/i },
  { key: "lemino", name: "Lemino", re: /lemino/i },
  { key: "telasa", name: "TELASA", re: /telasa/i },
  { key: "disney-plus", name: "Disney+", re: /disney|ディズニー/i },
  { key: "niconico", name: "ニコニコ", re: /niconico|ニコニコ/i },
  { key: "bandai-channel", name: "バンダイチャンネル", re: /bandai|バンダイ/i },
  { key: "anime-times", name: "アニメタイムズ", re: /anime\s?times|アニメタイムズ/i },
];

// 既知サービスへ正規化。YouTube・海外専用・不明サービスは null（勝手に既知へ割り当てない）
export function normalizeService(raw: string): StreamService | null {
  const s = (raw || "").trim();
  if (!s || isHiddenService(s)) return null;
  for (const d of SERVICE_DEFS) if (d.re.test(s)) return { key: d.key, name: d.name };
  return null;
}

// 表示用：既知でないサービスも元の名前のまま許可（キーは小文字化した元名）
export function toService(raw: string): StreamService | null {
  const s = (raw || "").trim();
  if (!s || isHiddenService(s)) return null;
  return normalizeService(s) ?? { key: s.toLowerCase(), name: s };
}

// 設定の契約中サービス名（例:「ABEMA（プレミアム）」）→ 正規化キーの配列
export function subscribedServiceKeys(settingNames: string[]): string[] {
  const keys: string[] = [];
  for (const n of settingNames) {
    const s = normalizeService(n);
    if (s && !keys.includes(s.key)) keys.push(s.key);
  }
  return keys;
}

// ---- cache/streamSchedule（しょぼいカレンダーのネット配信枠。Functionsが更新） ----
export type StreamProgram = {
  pid: number;
  tid: number;
  title: string;
  count: number | null;
  stTime: number; // 配信開始(UNIX秒)
  chName: string;
  serviceKey: string;
  serviceName: string;
};

let schedCache: Promise<{ programs: StreamProgram[]; updatedAt: Date | null }> | null = null;

/* eslint-disable @typescript-eslint/no-explicit-any */
export function getStreamSchedule(): Promise<{ programs: StreamProgram[]; updatedAt: Date | null }> {
  if (schedCache) return schedCache;
  schedCache = (async () => {
    try {
      const snap = await getDoc(doc(db, "cache", "streamSchedule"));
      const list = (snap.data()?.programs ?? []) as any[];
      const at = snap.data()?.updatedAt;
      const programs: StreamProgram[] = [];
      for (const p of list) {
        if (typeof p?.stTime !== "number" || !p?.serviceKey) continue;
        if (isHiddenService(String(p.chName ?? "")) ) continue; // 念のためYouTube等を即時除外
        programs.push({
          pid: Number(p.pid ?? 0),
          tid: Number(p.tid ?? 0),
          title: String(p.title ?? ""),
          count: typeof p.count === "number" ? p.count : null,
          stTime: p.stTime as number,
          chName: String(p.chName ?? ""),
          serviceKey: String(p.serviceKey),
          serviceName: String(p.serviceName ?? p.chName ?? ""),
        });
      }
      return { programs, updatedAt: at?.toDate?.() ?? null };
    } catch {
      schedCache = null; // 失敗は保持しない（次回再取得）
      return { programs: [], updatedAt: null };
    }
  })();
  return schedCache;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// 作品タイトルに一致する配信枠（短すぎる一致は誤結合防止のため除外）
export function matchPrograms(title: string, programs: StreamProgram[]): StreamProgram[] {
  const wt = normTitle(title);
  if (!wt) return [];
  const out: StreamProgram[] = [];
  for (const p of programs) {
    const pt = normTitle(p.title);
    if (!pt) continue;
    // 双方向の包含一致。ただし短い側が4文字未満なら信頼度が低いので表示しない（誤表示防止を優先）
    if (Math.min(pt.length, wt.length) < 4) continue;
    if (pt.includes(wt) || wt.includes(pt)) out.push(p);
  }
  return out;
}

// AniListのリンクと番組表の配信枠を、正規化キーで一つに統合した表示用データ
export type MergedStream = {
  key: string;
  name: string;
  url?: string; // AniListにあるときだけ（推測リンクは作らない）
  nextAt?: number; // 次回配信(UNIX秒)。番組表に根拠があるときだけ
  nextEp?: number | null;
};

export function mergeStreaming(
  anilistLinks: { name: string; url: string }[],
  matched: StreamProgram[]
): MergedStream[] {
  const map = new Map<string, MergedStream>();
  // AniList側（元の並び順を維持）
  for (const l of anilistLinks) {
    const svc = toService(l.name);
    if (!svc) continue;
    if (!map.has(svc.key)) map.set(svc.key, { key: svc.key, name: svc.name, url: l.url || undefined });
  }
  // 番組表側：未来で最も近い配信枠をサービスごとに反映
  const now = Date.now() / 1000;
  for (const p of matched) {
    if (p.stTime < now) continue;
    const cur = map.get(p.serviceKey);
    if (cur) {
      if (cur.nextAt == null || p.stTime < cur.nextAt) {
        cur.nextAt = p.stTime;
        cur.nextEp = p.count;
      }
    } else {
      map.set(p.serviceKey, {
        key: p.serviceKey,
        name: p.serviceName,
        nextAt: p.stTime,
        nextEp: p.count,
      });
    }
  }
  return [...map.values()];
}
