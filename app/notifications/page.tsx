"use client";

// 通知センター。users/{uid}/notifs をリアルタイム購読し、今日/昨日/それ以前に分けて表示。
// タップで既読＋作品詳細へ。✓✓で全既読。（作成はサーバーのみ・更新はreadのみ許可＝ルール準拠）
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

type Notif = {
  id: string;
  at: Timestamp | null;
  kind: string;
  text: string;
  workId: number | null;
  read: boolean;
};

function kindInfo(kind: string): { label: string; cls: string } {
  switch (kind) {
    case "stream":
      return { label: "配信入り", cls: "bg-[#E6F7F1] text-[#059669]" };
    case "adapt":
      return { label: "発表", cls: "bg-[#F1E9FE] text-[#7C3AED]" };
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
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[] | null>(null);

  useEffect(() => {
    if (!user) {
      setNotifs(null);
      return;
    }
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
          className="mt-3 inline-block rounded-full bg-[#5B4FCF] px-4 py-2 text-sm font-bold text-white"
        >
          ログイン
        </Link>
      </main>
    );
  }

  const uid = user.uid;

  const open = async (n: Notif) => {
    if (!n.read) {
      try {
        await updateDoc(doc(db, "users", uid, "notifs", n.id), { read: true });
      } catch {}
    }
    if (n.workId) router.push(`/work/${n.workId}`);
  };
  const markAllRead = async () => {
    const list = (notifs ?? []).filter((n) => !n.read);
    await Promise.all(
      list.map((n) =>
        updateDoc(doc(db, "users", uid, "notifs", n.id), { read: true }).catch(() => {})
      )
    );
  };

  const groups = ["今日", "昨日", "それ以前"]
    .map((label) => ({
      label,
      items: (notifs ?? []).filter((n) => n.at && bucketOf(n.at.toDate()) === label),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[#1C1C2E]">通知</h1>
        <button
          type="button"
          onClick={markAllRead}
          className="rounded-full bg-[#ECEAFD] px-3 py-1 text-xs font-bold text-[#5B4FCF]"
        >
          ✓✓ 全既読
        </button>
      </div>

      {notifs === null ? (
        <p className="mt-6 text-sm text-black/50">読み込み中…</p>
      ) : notifs.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-black/10 bg-white p-6 text-sm text-black/50">
          まだ通知はありません。作品を登録すると、新話や配信入りが届きます。
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="text-xs font-bold text-black/40">{g.label}</h2>
              <ul className="mt-2 space-y-2">
                {g.items.map((n) => {
                  const k = kindInfo(n.kind);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => open(n)}
                        className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left ${
                          n.read ? "border-black/10 bg-white" : "border-[#5B4FCF]/30 bg-[#F6F5FF]"
                        }`}
                      >
                        <span className={`mt-0.5 flex-none rounded-full px-2 py-0.5 text-[10px] font-bold ${k.cls}`}>
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
                          <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-[#5B4FCF]" />
                        )}
                      </button>
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
