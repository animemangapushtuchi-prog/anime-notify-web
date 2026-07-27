"use client";

// 今期配信データの確認・補正・公開（管理者のみ）。
// 書き込みはログイン中UIDが NEXT_PUBLIC_ADMIN_UIDS に含まれる場合だけ許可（URLの合言葉は使わない）。
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { currentSeasonKey, seasonInfo, adjacentSeasonKey } from "@/lib/season";
import { STREAM_SERVICES } from "@/lib/streaming";
import {
  listAdminEntries,
  saveEntry,
  saveEntries,
  parseImport,
  applyImport,
  isAdminUid,
  adminConfigured,
  MANUAL_ONLY_SERVICES,
  type AdminEntry,
  type EntryStatus,
} from "@/lib/seasonAdmin";
import type { Availability } from "@/lib/seasonStreaming";
import { buildCandidates } from "@/lib/seasonImport";
import ServiceIcon from "@/components/ServiceIcon";

const STATUS_JA: Record<EntryStatus, string> = {
  candidate: "候補",
  confirmed: "確認済み",
  rejected: "配信なし",
  unknown: "不明",
};
const AVAIL_JA: Record<Availability, string> = {
  included: "見放題",
  rental: "レンタル",
  channel: "追加チャンネル",
  free: "無料",
  unknown: "不明",
};
const WD = ["日", "月", "火", "水", "木", "金", "土"];

const toDateInput = (sec: number | null) =>
  sec == null ? "" : new Date(sec * 1000 + 9 * 3600 * 1000).toISOString().slice(0, 10);
const fromDateInput = (v: string) =>
  v ? Math.floor(new Date(`${v}T00:00:00+09:00`).getTime() / 1000) : null;

export default function AdminStreamingPage() {
  const { user, loading } = useAuth();
  const [seasonKey, setSeasonKey] = useState(currentSeasonKey());
  const [rows, setRows] = useState<AdminEntry[] | null>(null);
  const [filter, setFilter] = useState<EntryStatus | "all">("all");
  const [svcFilter, setSvcFilter] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<{ count: number; errors: string[] } | null>(null);

  const admin = isAdminUid(user?.uid);
  const info = seasonInfo(seasonKey);

  const load = async (key: string) => {
    setRows(null);
    try {
      setRows(await listAdminEntries(key));
    } catch {
      setRows([]);
      setMsg("読み込みに失敗しました（権限またはネットワークをご確認ください）");
    }
  };

  useEffect(() => {
    if (admin) load(seasonKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, seasonKey]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { candidate: 0, confirmed: 0, rejected: 0, unknown: 0 };
    for (const r of rows ?? []) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    let list = rows ?? [];
    if (filter !== "all") list = list.filter((r) => r.status === filter);
    if (svcFilter !== "all") list = list.filter((r) => r.serviceKey === svcFilter);
    return [...list].sort((a, b) => a.title.localeCompare(b.title, "ja"));
  }, [rows, filter, svcFilter]);

  const patch = (id: string, p: Partial<AdminEntry>) =>
    setRows((prev) => (prev ? prev.map((r) => (r.id === id ? { ...r, ...p } : r)) : prev));

  const save = async (e: AdminEntry) => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await saveEntry(seasonKey, e);
      setMsg(`保存しました：${e.title}（${e.serviceName}）`);
    } catch (err) {
      setMsg(`保存できません：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const publishAllConfirmed = async () => {
    if (busy || !rows) return;
    const target = rows.filter((r) => r.status === "confirmed" && !r.published);
    if (target.length === 0) {
      setMsg("公開対象（確認済みで未公開）はありません");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const next = target.map((r) => ({ ...r, published: true }));
      await saveEntries(seasonKey, next);
      setRows((prev) =>
        prev ? prev.map((r) => (target.some((t) => t.id === r.id) ? { ...r, published: true } : r)) : prev
      );
      setMsg(`${target.length}件を公開しました`);
    } catch (err) {
      setMsg(`公開できません：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // AniList＋番組表から候補を自動生成（すべて「候補」。自動で確認済みにはしない）
  const doBuild = async () => {
    if (busy) return;
    if (!window.confirm("AniListと番組表から今期の候補を作成します。既存の確認済み・配信なしの内容は変更しません。よろしいですか？")) return;
    setBusy(true);
    setMsg("候補を作成しています…（作品数によっては数十秒かかります）");
    try {
      const r = await buildCandidates(seasonKey);
      setMsg(`候補を更新しました：対象作品${r.works}件／生成${r.rows}行 → 新規${r.added}件・補完${r.updated}件・スキップ${r.skipped}件`);
      await load(seasonKey);
    } catch (err) {
      setMsg(`候補の作成に失敗：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const doPreview = () => {
    const { rows: parsed, errors } = parseImport(importText);
    setPreview({ count: parsed.length, errors });
  };

  const doImport = async () => {
    if (busy) return;
    const { rows: parsed, errors } = parseImport(importText);
    if (parsed.length === 0) {
      setMsg("取り込める行がありません" + (errors[0] ? `：${errors[0]}` : ""));
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await applyImport(seasonKey, parsed);
      setMsg(`取り込み完了：新規${r.added}件／補完${r.updated}件／スキップ${r.skipped}件`);
      setImportText("");
      setPreview(null);
      await load(seasonKey);
    } catch (err) {
      setMsg(`取り込みに失敗：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(rows ?? [], null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `seasonStreaming_${seasonKey}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) return <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-black/50">読み込み中…</main>;

  if (!adminConfigured)
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-xl font-extrabold text-[#1C1C2E]">今期配信データ管理</h1>
        <p className="mt-3 text-sm text-black/60">
          管理者UIDが未設定です。Vercelの環境変数 <code>NEXT_PUBLIC_ADMIN_UIDS</code> に、管理者の
          Firebase UID（カンマ区切り）を設定して再デプロイしてください。
        </p>
      </main>
    );

  if (!admin)
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-xl font-extrabold text-[#1C1C2E]">今期配信データ管理</h1>
        <p className="mt-3 text-sm text-black/60">
          {user ? "このアカウントには権限がありません。" : "管理者アカウントでログインしてください。"}
        </p>
      </main>
    );

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 lg:max-w-6xl lg:px-8">
      <h1 className="text-xl font-extrabold text-[#1C1C2E]">今期配信データ管理</h1>
      <p className="mt-1 text-[11px] text-[#6B7280]">
        確認済み＋公開のものだけが一般ページに出ます。Prime Video・Netflix は必ず出典を見て手動で確認済みにしてください。
      </p>

      {/* シーズン切替 */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold">
        <button type="button" onClick={() => setSeasonKey(adjacentSeasonKey(seasonKey, -1))} className="rounded-full border border-[#ECECF2] bg-white px-3 py-1 text-[#C2772A]">← 前</button>
        <span className="rounded-full bg-[#F6E9D5] px-3 py-1 text-[#8A5518]">{info.label}（{seasonKey}）</span>
        <button type="button" onClick={() => setSeasonKey(adjacentSeasonKey(seasonKey, 1))} className="rounded-full border border-[#ECECF2] bg-white px-3 py-1 text-[#C2772A]">次 →</button>
        <button type="button" onClick={() => load(seasonKey)} className="rounded-full border border-[#ECECF2] bg-white px-3 py-1 text-[#C2772A]">再読み込み</button>
        <button type="button" onClick={doBuild} disabled={busy} className="rounded-full border border-[#C2772A] bg-white px-3 py-1 text-[#C2772A] disabled:opacity-50">候補を更新</button>
        <button type="button" onClick={exportJson} className="rounded-full border border-[#ECECF2] bg-white px-3 py-1 text-[#C2772A]">JSONエクスポート</button>
        <button type="button" onClick={publishAllConfirmed} disabled={busy} className="rounded-full bg-[#C2772A] px-3 py-1 text-white disabled:opacity-50">確認済みを公開</button>
      </div>

      {msg && <p className="mt-3 rounded-xl bg-[#F6E9D5] px-3 py-2 text-xs font-bold text-[#8A5518]">{msg}</p>}

      {/* 取り込み */}
      <details className="mt-4 rounded-2xl border border-[#ECECF2] bg-white p-4">
        <summary className="cursor-pointer text-sm font-bold text-[#1C1C2E]">候補を貼り付けて取り込む（CSV / JSON）</summary>
        <p className="mt-2 text-[11px] text-[#6B7280]">
          CSV列：anilistId,title,serviceKey,availability,開始日(YYYY-MM-DD),曜日(0=日),時刻,出典URL<br />
          取り込んだ行は「候補」になります。確認済み・配信なしの既存データは上書きしません。
        </p>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={6}
          placeholder={`21,作品名,d-anime,included,2026-07-05,6,23:30,https://...`}
          className="mt-2 w-full rounded-xl border border-[#ECECF2] p-2 font-mono text-[11px] outline-none focus:border-[#C2772A]"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
          <button type="button" onClick={doPreview} className="rounded-full border border-[#ECECF2] px-3 py-1 text-[#C2772A]">検証（プレビュー）</button>
          <button type="button" onClick={doImport} disabled={busy || !preview || preview.count === 0} className="rounded-full bg-[#C2772A] px-3 py-1 text-white disabled:opacity-50">取り込む</button>
          {preview && (
            <span className="text-[11px] font-normal text-[#6B7280]">
              取り込み可能 {preview.count}件{preview.errors.length ? ` / エラー ${preview.errors.length}件：${preview.errors.slice(0, 2).join(" / ")}` : ""}
            </span>
          )}
        </div>
      </details>

      {/* 絞り込み */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold">
        {(["all", "candidate", "confirmed", "rejected", "unknown"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1 ${filter === k ? "bg-[#C2772A] text-white" : "border border-[#ECECF2] bg-white text-[#6B7280]"}`}
          >
            {k === "all" ? `すべて ${rows?.length ?? 0}` : `${STATUS_JA[k]} ${counts[k] ?? 0}`}
          </button>
        ))}
        <select value={svcFilter} onChange={(e) => setSvcFilter(e.target.value)} className="rounded-full border border-[#ECECF2] bg-white px-2 py-1 text-[#1C1C2E]">
          <option value="all">全サービス</option>
          {STREAM_SERVICES.map((s) => (
            <option key={s.key} value={s.key}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* 一覧 */}
      {rows === null ? (
        <p className="mt-6 text-sm text-black/50">読み込み中…</p>
      ) : shown.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-[#ECECF2] bg-white p-6 text-sm text-black/50">
          データがありません。上の「貼り付けて取り込む」から候補を追加してください。
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {shown.map((e) => {
            const manualOnly = MANUAL_ONLY_SERVICES.includes(e.serviceKey);
            return (
              <li key={e.id} className="rounded-2xl border border-[#ECECF2] bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ServiceIcon name={e.serviceName} size={18} />
                  <span className="text-sm font-bold text-[#1C1C2E]">{e.title || `#${e.anilistId}`}</span>
                  <span className="text-[11px] text-[#6B7280]">{e.serviceName}</span>
                  {manualOnly && <span className="rounded bg-[#FDEAEA] px-1.5 py-0.5 text-[10px] font-bold text-[#DC2626]">要手動確認</span>}
                  {e.published && <span className="rounded bg-[#EAF3DE] px-1.5 py-0.5 text-[10px] font-bold text-[#3B6D11]">公開中</span>}
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
                  <label className="flex flex-col gap-0.5">状態
                    <select value={e.status} onChange={(ev) => patch(e.id, { status: ev.target.value as EntryStatus })} className="rounded border border-[#ECECF2] px-1.5 py-1">
                      {(Object.keys(STATUS_JA) as EntryStatus[]).map((k) => (
                        <option key={k} value={k}>{STATUS_JA[k]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5">種別
                    <select value={e.availability} onChange={(ev) => patch(e.id, { availability: ev.target.value as Availability })} className="rounded border border-[#ECECF2] px-1.5 py-1">
                      {(Object.keys(AVAIL_JA) as Availability[]).map((k) => (
                        <option key={k} value={k}>{AVAIL_JA[k]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5">初回配信日
                    <input type="date" value={toDateInput(e.firstAvailableAt)} onChange={(ev) => patch(e.id, { firstAvailableAt: fromDateInput(ev.target.value) })} className="rounded border border-[#ECECF2] px-1.5 py-1" />
                  </label>
                  <label className="flex flex-col gap-0.5">毎週
                    <span className="flex gap-1">
                      <select value={e.weeklyDay ?? ""} onChange={(ev) => patch(e.id, { weeklyDay: ev.target.value === "" ? null : Number(ev.target.value) })} className="w-full rounded border border-[#ECECF2] px-1 py-1">
                        <option value="">—</option>
                        {WD.map((w, i) => (<option key={i} value={i}>{w}</option>))}
                      </select>
                      <input type="time" value={e.weeklyTime ?? ""} onChange={(ev) => patch(e.id, { weeklyTime: ev.target.value || null })} className="w-full rounded border border-[#ECECF2] px-1 py-1" />
                    </span>
                  </label>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={e.isExclusive} onChange={(ev) => patch(e.id, { isExclusive: ev.target.checked })} />独占
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={e.isFastest} onChange={(ev) => patch(e.id, { isFastest: ev.target.checked })} />最速
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={e.published} onChange={(ev) => patch(e.id, { published: ev.target.checked })} />公開する
                  </label>
                </div>

                <div className="mt-2 flex flex-col gap-2 md:flex-row">
                  <input
                    type="url"
                    value={e.sourceUrl}
                    onChange={(ev) => patch(e.id, { sourceUrl: ev.target.value })}
                    placeholder="出典URL（確認済みにするには必須）"
                    className="w-full rounded border border-[#ECECF2] px-2 py-1 text-[11px]"
                  />
                  <input
                    type="text"
                    value={e.note}
                    onChange={(ev) => patch(e.id, { note: ev.target.value })}
                    placeholder="管理メモ（一般には出ません）"
                    className="w-full rounded border border-[#ECECF2] px-2 py-1 text-[11px]"
                  />
                  <button type="button" onClick={() => save(e)} disabled={busy} className="flex-none rounded-full bg-[#C2772A] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                    保存
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
