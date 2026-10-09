"use client";

// 開発者ダッシュボード（管理者のみ）。Functionsが集計した cache/stats を表示。
// 以前は URL の ?key=... で入れる方式だったが、合言葉はクライアントJSに
// そのまま含まれて誰でも読めてしまうため、/admin/streaming と同じ
// 「ログイン中UIDが NEXT_PUBLIC_ADMIN_UIDS に含まれるか」で判定する方式に変更した。
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore/lite";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { isAdminUid, adminConfigured } from "@/lib/seasonAdmin";

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
  pages?: Record<string, Record<string, number>>; // 日付 → ページの種類 → 表示数（2026-10-09〜）
  refs?: Record<string, Record<string, number>>; // 日付 → どこから来たか → 訪問数（2026-10-09〜）
};

const PAGE_JA: Record<string, string> = {
  top: "トップ", work: "作品ページ", streaming: "配信一覧", osusume: "記事", search: "検索",
  calendar: "カレンダー", me: "マイリスト", notifications: "通知", settings: "設定", login: "ログイン",
  guide: "使い方", survey: "アンケート", terms: "利用規約", privacy: "プライバシー", other: "その他",
};
const REF_JA: Record<string, string> = {
  google: "Google", yahoo: "Yahoo!", bing: "Bing", x: "X（旧Twitter）", sns: "その他のSNS",
  direct: "直接（ブックマーク・アプリなど）", internal: "サイト内", other: "その他のサイト",
};

// 直近の日付ぶんを合計して、多い順に並べる
function sumDays(m: Record<string, Record<string, number>> | undefined, days: string[], ja: Record<string, string>) {
  const tot: Record<string, number> = {};
  for (const d of days) for (const [k, v] of Object.entries(m?.[d] ?? {})) tot[k] = (tot[k] ?? 0) + v;
  return Object.entries(tot)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: ja[k] ?? k, value: v }));
}

function Card({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[#ECE5DA] bg-white p-4">
      <p className="text-[11px] font-bold text-[#625B6E]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-[#1A1523]">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[#625B6E]">{sub}</p>}
    </div>
  );
}

function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-40 flex-none truncate text-[12px] text-[#3A3342]">{d.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#F2ECE3]">
            <div className="h-full rounded-full bg-[#A8621F]" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="w-8 flex-none text-right text-[11px] font-bold text-[#1A1523]">{d.value}</span>
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
  const { user, loading } = useAuth();
  const [s, setS] = useState<Stats | null>(null);
  const [copied, setCopied] = useState(false);

  const admin = isAdminUid(user?.uid);

  const load = () =>
    getDoc(doc(db, "cache", "stats"))
      .then((d) => setS(((d.data() as Stats) || {}) as Stats))
      .catch(() => setS({}));

  useEffect(() => {
    if (!admin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  if (loading) return <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-black/50">読み込み中…</main>;

  // 管理者UIDが未設定 / 権限なしのときは、設定に必要な「自分のUID」を画面に出す
  if (!adminConfigured || !admin)
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-[28px] font-black leading-tight text-ink lg:text-[34px]">ダッシュボード</h1>
        {!user ? (
          <p className="mt-3 text-sm text-black/60">
            管理に使うアカウントで
            <a href="/login" className="font-bold text-[#8A5518] underline">ログイン</a>
            してください。
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-black/60">
              {adminConfigured
                ? "このアカウントには権限がありません。"
                : "管理者がまだ設定されていません。下のUIDを設定すると、このアカウントで管理できます。"}
            </p>
            <div className="mt-4 rounded-2xl border border-[#ECE5DA] bg-white p-4">
              <p className="text-[11px] font-bold text-[#625B6E]">あなたのUID</p>
              <p className="mt-0.5 break-all font-mono text-sm text-[#1A1523]">{user.uid}</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(user.uid);
                  setCopied(true);
                }}
                className="mt-3 rounded-full bg-[#A8621F] px-4 py-1.5 text-xs font-bold text-white"
              >
                UIDをコピー
              </button>
              {copied && <p className="mt-2 text-[11px] font-bold text-[#8A5518]">UIDをコピーしました</p>}
            </div>
          </>
        )}
      </main>
    );

  const st = s ?? {};
  const days = last14();
  const pvBars = days.map((d) => ({ label: d.slice(5), value: st.pv?.[d] ?? 0 }));
  const uvBars = days.map((d) => ({ label: d.slice(5), value: st.uv?.[d] ?? 0 }));
  const last7 = days.slice(-7);
  const pageBars = sumDays(st.pages, last7, PAGE_JA);
  const refBars = sumDays(st.refs, last7, REF_JA);
  const platforms = Object.entries(st.platforms ?? {}).map(([k, v]) => ({ label: k, value: v }));
  const works = (st.worksTop ?? []).map((w) => ({ label: w.title || `#${w.id}`, value: w.count }));
  const updated = st.updatedAt?.seconds ? new Date(st.updatedAt.seconds * 1000).toLocaleString("ja-JP") : "—";

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-black leading-tight text-ink lg:text-[34px]">ダッシュボード</h1>
        <button type="button" onClick={load} className="rounded-full border border-[#ECE5DA] bg-white px-3 py-1 text-xs font-bold text-[#8A5518]">再読み込み</button>
      </div>
      <p className="mt-1 text-[11px] text-[#625B6E]">集計時刻：{updated}（自動更新：3時間ごと）</p>

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
          <section className="mt-6 rounded-2xl border border-[#ECE5DA] bg-white p-4">
            <h2 className="text-xs font-bold text-[#625B6E]">アクセス数（PV・過去14日）</h2>
            <div className="mt-2">
              <Bars data={pvBars} />
            </div>
            <h2 className="mt-4 text-xs font-bold text-[#625B6E]">ユニーク訪問者（UV・過去14日）</h2>
            <div className="mt-2">
              <Bars data={uvBars} />
            </div>
          </section>

          {/* ページの種類・どこから来たか（過去7日） */}
          <section className="mt-6 rounded-2xl border border-[#ECE5DA] bg-white p-4">
            <h2 className="text-xs font-bold text-[#625B6E]">見られたページの種類（PV・過去7日）</h2>
            {pageBars.length === 0 ? (
              <p className="mt-2 text-xs text-black/40">まだデータがありません（2026年10月9日から記録）。</p>
            ) : (
              <div className="mt-2">
                <Bars data={pageBars} />
              </div>
            )}
            <h2 className="mt-4 text-xs font-bold text-[#625B6E]">どこから来たか（訪問の入口・過去7日）</h2>
            {refBars.length === 0 ? (
              <p className="mt-2 text-xs text-black/40">まだデータがありません（2026年10月9日から記録）。</p>
            ) : (
              <div className="mt-2">
                <Bars data={refBars} />
              </div>
            )}
            <p className="mt-3 text-[11px] text-[#625B6E]">本番サイトでの表示だけを数えています（確認用サイト・自動操作のブラウザ・管理画面は除外）。</p>
          </section>

          {/* 登録作品ランキング */}
          <section className="mt-6 rounded-2xl border border-[#ECE5DA] bg-white p-4">
            <h2 className="text-xs font-bold text-[#625B6E]">登録作品ランキング（人気順・上位20）</h2>
            {works.length === 0 ? (
              <p className="mt-2 text-xs text-black/40">まだデータがありません。</p>
            ) : (
              <div className="mt-2">
                <Bars data={works} />
              </div>
            )}
          </section>

          {/* 端末プラットフォーム比率 */}
          <section className="mt-6 rounded-2xl border border-[#ECE5DA] bg-white p-4">
            <h2 className="text-xs font-bold text-[#625B6E]">端末プラットフォーム</h2>
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
            <section className="mt-6 rounded-2xl border border-[#ECE5DA] bg-white p-4">
              <h2 className="text-xs font-bold text-[#625B6E]">視聴ステータス内訳（登録作品）</h2>
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
