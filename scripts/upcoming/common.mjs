// scan.mjs と build.mjs で共通に使うもの（保存場所・台帳の読み込み・文字列の照合）
import { readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const SEASON = "2027-winter";
export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const LEDGER = fileURLToPath(new URL(`./${SEASON}.evidence.json`, import.meta.url));
export const CONTENT = join(ROOT, "content", "upcoming", `${SEASON}.json`);
export const OUT_DIR = fileURLToPath(new URL("./out/", import.meta.url));
// 読んだ公式ページの本文の保存先（OS の一時フォルダ）
export const CACHE_DIR = join(tmpdir(), "animiru-upcoming", SEASON);

export function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function readLedger() {
  const l = readJson(LEDGER, null);
  if (!l) throw new Error(`台帳がありません: ${LEDGER}`);
  return { season: l.season, schedule: l.schedule ?? [], streaming: l.streaming ?? [], skip: l.skip ?? [] };
}

// 照合用：全角半角をそろえ（NFKC）、空白をすべて取り除く
export function norm(s) {
  return String(s ?? "").normalize("NFKC").replace(/\s+/g, "");
}

// evidence が含まれるページを返す（無ければ null）
export function findEvidence(pages, evidence) {
  const e = norm(evidence);
  if (!e) return null;
  return pages.find((p) => norm(p.text).includes(e)) ?? null;
}

// 保存した作品ごとの本文 { id, title, results: [{ start, status, reason, pages }] } → ページの一覧（同じURLは1回）
export function pagesOf(saved) {
  const seen = new Set();
  const out = [];
  for (const r of saved?.results ?? []) {
    for (const p of r.pages ?? []) {
      if (seen.has(p.url)) continue;
      seen.add(p.url);
      out.push(p);
    }
  }
  return out;
}

export function todayJst() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
