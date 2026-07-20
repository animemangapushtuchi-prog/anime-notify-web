"use client";

// 通知センター。通知から作品詳細・配信先・カレンダー・視聴状態の変更へ進める。
import { useEffect, useState } from "react";
import Link from "next/link";
import Mascot from "@/components/Mascot";
import StatusPicker from "@/components/StatusPicker";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import {
  getWorks,
  setWatchStatus,
  type Work,
  type WatchStatus,
} from "@/lib/works";

type Notif = {
  id: string;
  at: Timestamp | null;
  kind: string;
  text: string;
  workId: number | null;
  targetWorkId: number | null; // 続編通知：新しく発表された続編のAniList ID（後方互換の任意項目）
  read: boolean;
};

const KIND_FILTERS = [
  { key: "all", label: "すべて" },
  { key: "ep", label: "放送・新話" },
  { key: "stream", label: "配信入り" },
  { key: "adapt", label: "発表" },
];
function matchesFilter(kind: string, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "ep")
    return ["ep", "start", "finish", "bcsoon", "bctomorrow"].includes(kind);
  return kind === filter;
}

function kindInfo(kind: string): { label: string; cls: string } {
  switch (kind) {
    case "stream":
      return { label: "配信入り", cls: "bg-[#E6F7F1] text-[#059669]" };
    case "adapt":
      return { label: "発表", cls: "bg-[#F1E9FE] text-[#7C3AED]" };
    case "bcsoon":
      return { label: "放送前", cls: "bg-[#FDEAEA] text-[#DC2626]" };
    case "bctomorrow":
      return { label: "明日の予定", cls: "bg-[#FEF3C7] text-[#B45309]" };
    case "test":
      return { label: "テスト", cls: "bg-black/5 text-black/50" };
    default:
      return { label: "新話", cls: "bg-[#E8F0FE] text-[#2563EB]" };
  }
}
function bucketOf(d: Date): string {
  const s = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = s(new Date()) - s(d);
  if (diff <= 0) return "今日";
  if (diff === 86400000) return "昨日";
  return "それ以前";
}
function fmtTime(d: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? `${two(d.getHours())}:${two(d.getMinutes())}`
    : `${d.getMonth() + 1}/${d.getDate()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const [notifs, setNotifs] = useState<Notif[] | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [filter, setFilter] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    if (!user) {
      setNotifs(null);
      setWorks([]);
      return;
    }
    getWorks(user.uid).then(setWorks).catch(() => setWorks([]));
    const q = query(
      collection(db, "users", user.uid, "notifs"),
      orderBy("at", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotifs(
          snap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              at: x.at ?? null,
              kind: String(x.kind ?? "ep"),
              text: String(x.text ?? ""),
              workId: typeof x.workId === "number" ? x.workId : null,
              targetWorkId: typeof x.targetWorkId === "number" ? x.targetWorkId : null,
              read: !!x.read,
            };
          })
        );
      },
      () => setNotifs([])
    );
    return () => unsub();
  }, [user]);

  if (loading) {
    return <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-black/50">読み込み中…</main>;
  }
  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <p className="text-sm text-black/60">ログインすると通知と履歴が使えます。</p>
        <Link
          href="/login"
          className="mt-3 inline-block rounded-full bg-[#C2772A] px-4 py-2 text-sm font-bold text-white"
        >
          ログイン
        </Link>
      </main>
    );
  }

  const uid = user.uid;

  const markRead = async (n: Notif) => {
    if (n.read) return;
    try {
      await updateDoc(doc(db, "users", uid, "notifs", n.id), { read: true });
    } catch {}
  };

  const markAllRead = async () => {
    const list = (notifs ?? []).filter((n) => !n.read);
    await Promise.all(
      list.map((n) =>
        updateDoc(doc(db, "users", uid, "notifs", n.id), { read: true }).catch(() => {})
      )
    );
  };

  const changeStatus = async (id: number, status: WatchStatus | null) => {
    setWorks((prev) =>
      prev.map((work) =>
        work.id === id ? { ...work, watchStatus: status ?? undefined } : work
      )
    );
    try {
      await setWatchStatus(uid, id, status);
    } catch {}
  };

  const unreadCount = (notifs ?? []).filter((n) => !n.read).length;
  const shown = (notifs ?? []).filter(
    (n) => matchesFilter(n.kind, filter) && (!unreadOnly || !n.read)
  );
  const groups = ["今日", "昨日", "それ以前"]
    .map((label) => ({
      label,
      items: shown.filter((n) => n.at && bucketOf(n.at.toDate()) === label),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 lg:max-w-3xl lg:px-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mascot pose="device" h={44} />
          <h1 className="text-2xl font-extrabold text-[#1C1C2E]">通知</h1>
        </div>
        <button
          type="button"
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="rounded-full bg-[#F6E9D5] px-3 py-1 text-xs font-bold text-[#C2772A] disabled:opacity-40"
        >
          ✓✓ 全既読{unreadCount > 0 ? `（${unreadCount}）` : ""}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setUnreadOnly((value) => !value)}
          className={`rounded-full px-3 py-1 text-xs font-bold transition ${
            unreadOnly
              ? "bg-[#1C1C2E] text-white"
              : "border border-[#ECECF2] bg-white text-[#6B7280]"
          }`}
        >
          未読のみ {unreadCount}
        </button>
        {KIND_FILTERS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              filter === t.key ? "bg-[#C2772A] text-white" : "bg-[#F6E9D5] text-[#C2772A]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notifs === null ? (
        <p className="mt-6 text-sm text-black/50">読み込み中…</p>
      ) : shown.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-[#ECECF2] bg-white p-6 text-center text-sm text-black/50">
          {notifs.length === 0 ? (
            <>
              <Mascot pose="sleep" h={120} />
              <p>まだ通知はありません。作品を登録すると、新話や配信入りが届きます。</p>
            </>
          ) : (
            <p>この種別の通知はありません。</p>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="text-xs font-bold text-black/40">{g.label}</h2>
              <ul className="mt-2 space-y-2">
                {g.items.map((n) => {
                  const k = kindInfo(n.kind);
                  const work = n.workId
                    ? works.find((item) => item.id === n.workId)
                    : undefined;
                  // 続編通知は新しく発表された続編（targetWorkId）へ、配信通知は対象作品のネット配信欄へ
                  const detailId =
                    n.kind === "adapt" && n.targetWorkId ? n.targetWorkId : n.workId;
                  const actionHref = detailId
                    ? `/work/${detailId}`
                    : n.kind === "bctomorrow"
                      ? "/calendar"
                      : null;
                  const actionLabel =
                    n.kind === "stream"
                      ? "配信先を確認"
                      : n.kind === "adapt" && n.targetWorkId
                        ? "新しい作品を見る"
                        : n.kind === "bctomorrow"
                          ? "カレンダーを見る"
                          : n.kind === "bcsoon"
                            ? "放送情報を見る"
                            : "作品詳細を見る";
                  return (
                    <li
                      key={n.id}
                      className={`rounded-2xl border p-3 ${
                        n.read
                          ? "border-[#ECECF2] bg-white"
                          : "border-[#C2772A]/30 bg-[#FBF3E6]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex-none rounded-full px-2 py-0.5 text-[10px] font-bold ${k.cls}`}
                        >
                          {k.label}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block whitespace-pre-line text-sm text-[#1C1C2E]">
                            {n.text}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-black/40">
                            {n.at ? fmtTime(n.at.toDate()) : ""}
                          </span>
                        </span>
                        {!n.read && (
                          <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-[#C2772A]" />
                        )}
                      </div>

                      <div
                        className={`mt-3 flex flex-wrap items-center gap-2 border-t pt-2.5 ${
                          n.read ? "border-[#ECECF2]" : "border-[#C2772A]/15"
                        }`}
                      >
                        {actionHref && (
                          <Link
                            href={actionHref}
                            onClick={() => markRead(n)}
                            className="rounded-full bg-[#C2772A] px-3 py-1.5 text-[11px] font-bold text-white"
                          >
                            {actionLabel} ›
                          </Link>
                        )}
                        {work && (
                          <StatusPicker
                            current={work.watchStatus}
                            onChange={(status) => changeStatus(work.id, status)}
                            size="sm"
                          />
                        )}
                        {!n.read && (
                          <button
                            type="button"
                            onClick={() => markRead(n)}
                            className="ml-auto px-2 py-1 text-[11px] font-bold text-[#6B7280]"
                          >
                            既読にする
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
