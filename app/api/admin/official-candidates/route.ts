import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { FIREBASE_WEB_API_KEY } from "@/lib/firebase";
import { isAdminUid } from "@/lib/seasonAdmin";
import { parseSeasonKey } from "@/lib/season";
import { collectOfficialPages, isSafePublicUrl } from "@/lib/officialSite";
import { extractStreaming } from "@/lib/extractStreaming";

// 1作品ぶんの公式サイトを読み、配信候補の行を返す（管理画面の「公式サイトから候補を集める」用）。
// - 管理者だけが呼べる（Claude API の利用料がかかるため）
// - Firestore への書き込みはここではしない。返した行を、管理者のブラウザが
//   既存の applyImport で「候補」として取り込む（権限は firestore.rules で管理者に限定済み）
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SEASON_MONTHS: Record<string, string> = {
  winter: "1月〜3月",
  spring: "4月〜6月",
  summer: "7月〜9月",
  fall: "10月〜12月",
};

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
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません（Vercel の環境変数に登録してください）" },
      { status: 500 }
    );
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
    return NextResponse.json({ status: site.status, reason: site.reason, rows: [], usage: null });
  }

  try {
    const r = await extractStreaming({
      anilistId,
      title,
      seasonLabel: `${season.label}（${season.year}年${SEASON_MONTHS[season.season]}）`,
      pages: site.pages,
    });
    return NextResponse.json({
      status: r.refused ? "refused" : "ok",
      reason: r.refused ? "AIが処理を断りました" : undefined,
      rows: r.rows,
      dropped: r.dropped,
      pages: site.pages.map((p) => p.url),
      usage: r.usage,
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Claude API の利用上限に達しました。少し待って再実行してください" }, { status: 429 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY が無効です" }, { status: 500 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Claude API エラー（${err.status}）` }, { status: 502 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
