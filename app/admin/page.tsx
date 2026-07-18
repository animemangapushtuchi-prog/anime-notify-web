"use client";

// 開発者ダッシュボード（合言葉つき）。Functionsが集計した cache/stats を表示。
// URL: /admin?key=... 。cache/stats は集計値のみ（個人情報なし）。
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const ADMIN_KEY = "animiru-admin-2026";

type Stats = {
  updatedAt?: { seconds: number };
  users?: number;
  registrations?: number;
  avgReg?: number;
  worksTop?: { id: number; title: string; count: number }[];
  statusCount?: Record<string, number>;
  tokens?: number;
  platforms?: Record<string, number>;
  survey?: { count?: number; satisfactionAvg?: number | null; continueUse?: Record<string, number> };
  pv?: Record<string, number>;
  uv?: Record<string, number>;
};

function Card({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[#ECECF2] bg-white p-4">
      <p className="text-[11px] font-bold text-[#6B7280]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-[#1C1C2E]">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[#6B7280]">{sub}</p>}
    </div>
  );
}

function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-40 flex-none truncate text-[12px] text-[#374151]">{d.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#F1F1F5]">
            <div className="h-full rounded-full bg-[#C2772A]" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="w-8 flex-none text-right text-[11px] font-bold text-[#1C1C2E]">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

const last14 = (): string[] => {
  const out: string[] = [];
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`);
  }
  return out;
};

export default function AdminPage() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [s, setS] = useState<Stats | null>(null);

  const load = () =>
    getDoc(doc(db, "cache", "stats"))
      .then((d) => setS(((d.data() as Stats) || {}) as Stats))
      .catch(() => setS({}));

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("key");
    if (key !== ADMIN_KEY) {
      setOk(false);
      return;
    }
    setOk(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (ok === null) return <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-black/50">読み込み中…</main>;
  if (!ok)
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-black/60">アクセスできません。URLに <code>?key=</code> が必要です。</p>
      </main>
    );

  const st = s ?? {};
  const days = last14();
  const pvBars = days.map((d) => ({ label: d.slice(5), value: st.pv?.[d] ?? 0 }));
  const uvBars = days.map((d) => ({ label: d.slice(5), value: st.uv?.[d] ?? 0 }));
  const platforms = Object.entries(st.platforms ?? {}).map(([k, v]) => ({ label: k, value: v }));
  const works = (st.worksTop ?? []).map((w) => ({ label: w.title || `#${w.id}`, value: w.count }));
  const updated = st.updatedAt?.seconds ? new Date(st.updatedAt.seconds * 1000).toLocaleString("ja-JP") : "—";

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-[#1C1C2E]">📊 ダッシュボード</h1>
        <button type="button" onClick={load} className="rounded-full border border-[#ECECF2] bg-white px-3 py-1 text-xs font-bold text-[#C2772A]">再読み込み</button>
      </div>
      <p className="mt-1 text-[11px] text-[#6B7280]">集計時刻：{updated}（自動更新：3時間ごと）</p>

      {s === null ? (
        <p className="mt-6 text-sm text-black/50">読み込み中…</p>
      ) : (
        <>
          {/* サマリーカード */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card label="ユーザー数" value={st.users ?? 0} />
            <Card label="総登録数" value={st.registrations ?? 0} sub={`平均 ${st.avgReg ?? 0}件/人`} />
            <Card label="端末数（通知）" value={st.tokens ?? 0} />
            <Card label="アンケート回答" value={st.survey?.count ?? 0} sub={st.survey?.satisfactionAvg != null ? `満足度 ${st.survey.satisfactionAvg}` : undefined} />
            <Card label="本日のPV" value={st.pv?.[days[days.length - 1]] ?? 0} sub={`UV ${st.uv?.[days[days.length - 1]] ?? 0}`} />
          </div>

          {/* アクセス数（PV/UV 過去14日） */}
          <section className="mt-6 rounded-2xl border border-[#ECECF2] bg-white p-4">
            <h2 className="text-xs font-bold text-[#6B7280]">アクセス数（PV・過去14日）</h2>
            <div className="mt-2">
              <Bars data={pvBars} />
            </div>
            <h2 className="mt-4 text-xs font-bold text-[#6B7280]">ユニーク訪問者（UV・過去14日）</h2>
            <div className="mt-2">
              <Bars data={uvBars} />
            </div>
          </section>

          {/* 登録作品ランキング */}
          <section className="mt-6 rounded-2xl border border-[#ECECF2] bg-white p-4">
            <h2 className="text-xs font-bold text-[#6B7280]">登録作品ランキング（人気順・上位20）</h2>
            {works.length === 0 ? (
              <p className="mt-2 text-xs text-black/40">まだデータがありません。</p>
            ) : (
              <div className="mt-2">
                <Bars data={works} />
              </div>
            )}
          </section>

          {/* 端末プラットフォーム比率 */}
          <section className="mt-6 rounded-2xl border border-[#ECECF2] bg-white p-4">
            <h2 className="text-xs font-bold text-[#6B7280]">端末プラットフォーム</h2>
            {platforms.length === 0 ? (
              <p className="mt-2 text-xs text-black/40">まだデータがありません。</p>
            ) : (
              <div className="mt-2">
                <Bars data={platforms} />
              </div>
            )}
          </section>

          {/* 視聴ステータス内訳 */}
          {st.statusCount && (
            <section className="mt-6 rounded-2xl border border-[#ECECF2] bg-white p-4">
              <h2 className="text-xs font-bold text-[#6B7280]">視聴ステータス内訳（登録作品）</h2>
              <div className="mt-2">
                <Bars
                  data={[
                    { label: "見たい", value: st.statusCount.want ?? 0 },
                    { label: "見てる", value: st.statusCount.watching ?? 0 },
                    { label: "見た", value: st.statusCount.watched ?? 0 },
                    { label: "中断", value: st.statusCount.paused ?? 0 },
                    { label: "中止", value: st.statusCount.dropped ?? 0 },
                    { label: "未設定", value: st.statusCount.none ?? 0 },
                  ]}
                />
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
