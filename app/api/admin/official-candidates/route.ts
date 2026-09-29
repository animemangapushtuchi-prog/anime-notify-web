import { NextResponse } from "next/server";
import { FIREBASE_WEB_API_KEY } from "@/lib/firebase";
import { isAdminUid } from "@/lib/seasonAdmin";
import { parseSeasonKey } from "@/lib/season";
import { collectOfficialPages, isSafePublicUrl } from "@/lib/officialSite";
import { extractStreaming } from "@/lib/extractStreaming";

// 1作品ぶんの公式サイトを読み、配信候補の行を返す（管理画面の「公式サイトから候補を集める」用）。
// - 管理者だけが呼べる（外部サイトへのアクセスを第三者に使わせないため）
// - 有料APIは使わない。抽出は lib/extractStreaming.ts の決まったパターンで行う
// - Firestore への書き込みはここではしない。返した行を、管理者のブラウザが
//   既存の applyImport で「候補」として取り込む（権限は firestore.rules で管理者に限定済み）
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Firebase のIDトークンを検証し、ログイン中ユーザーのUIDを返す
async function verifyUid(req: Request): Promise<string | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
      cache: "no-store",
    }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { users?: { localId?: string }[] };
  return json.users?.[0]?.localId ?? null;
}

export async function POST(req: Request) {
  const uid = await verifyUid(req);
  if (!uid || !isAdminUid(uid)) {
    return NextResponse.json({ error: "管理者としてログインしてください" }, { status: 403 });
  }

  let body: { anilistId?: unknown; title?: unknown; officialUrl?: unknown; seasonKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  const anilistId = Number(body.anilistId);
  const title = String(body.title ?? "").trim();
  const officialUrl = String(body.officialUrl ?? "");
  const season = parseSeasonKey(String(body.seasonKey ?? ""));
  if (!Number.isFinite(anilistId) || anilistId <= 0 || !title || !season || !isSafePublicUrl(officialUrl)) {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const site = await collectOfficialPages(officialUrl);
  if (site.status !== "ok") {
    return NextResponse.json({ status: site.status, reason: site.reason, rows: [] });
  }

  const r = extractStreaming({
    anilistId,
    title,
    season: { year: season.year, season: season.season },
    pages: site.pages,
  });
  return NextResponse.json({
    status: "ok",
    rows: r.rows,
    excluded: r.excluded,
    pages: site.pages.map((p) => p.url),
  });
}
