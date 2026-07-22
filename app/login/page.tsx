"use client";

// ログイン／新規登録／パスワード再設定＋ゲスト向けのメール引き継ぎ・既存アカウント統合。
// 利用状態（visitor/guest/pending/member）で表示を切り替える。
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signIn,
  signUp,
  resetPassword,
  authErrorJa,
  useAuth,
  linkGuestToEmail,
  resendVerification,
} from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { getWorks, GUEST_SLOTS, MEMBER_BASE_SLOTS, MEMBER_MAX_SLOTS } from "@/lib/works";
import Mascot from "@/components/Mascot";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Mode = "login" | "signup" | "reset";
const MERGE_URL =
  "https://asia-northeast1-anime-notify-app-86ccc.cloudfunctions.net/mergeGuestAccount";

// パスワード強度（0〜4）
function pwScore(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}
const PW_LABEL = ["とても弱い", "弱い", "普通", "強い", "とても強い"];
const PW_COLOR = ["#DC2626", "#DC2626", "#B45309", "#059669", "#059669"];

// ログイン後の戻り先はサイト内URLだけを許可する。
function returnPath(): string {
  if (typeof window === "undefined") return "/";
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
}

// 強いパスワードを生成（紛らわしい文字は除外）
function generatePw(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*?";
  const arr = crypto.getRandomValues(new Uint32Array(16));
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

type GuestOnlyWork = { id: number; title: string };
type MergeState = {
  guestToken: string;
  cap: number;
  free: number;
  memberCount: number;
  guestOnly: GuestOnlyWork[];
  selected: number[];
};

export default function LoginPage() {
  const router = useRouter();
  const { user, accountType, refreshAccount } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  // ゲスト向けタブ："link"=メール登録（引き継ぎ） / "merge"=既存アカウントへログインして統合
  const [guestTab, setGuestTab] = useState<"link" | "merge">("link");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState<number | null>(null);
  const [merge, setMerge] = useState<MergeState | null>(null);
  const [checked, setChecked] = useState(false);

  const score = pwScore(pw);
  const isGuest = accountType === "guest";

  useEffect(() => {
    if (user && isGuest) {
      getWorks(user.uid)
        .then((w) => setGuestCount(w.length))
        .catch(() => setGuestCount(null));
    }
  }, [user, isGuest]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setErr(null);
    setMsg(null);
  };

  // ---- visitor：通常のログイン／新規登録／再設定 ----
  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (mode === "reset") {
      if (!EMAIL_RE.test(email.trim())) {
        setErr("メールアドレスの形式が正しくありません");
        return;
      }
      setBusy(true);
      try {
        await resetPassword(email);
        setMsg("パスワード再設定用のメールを送りました。受信箱（迷惑メールも）をご確認ください。");
      } catch (e2) {
        setErr(authErrorJa(e2));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === "signup" && !EMAIL_RE.test(email.trim())) {
      setErr("メールアドレスを入力してください");
      return;
    }
    if (pw.length < 6) {
      setErr("パスワードは6文字以上にしてください");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") await signUp(email, pw);
      else await signIn(email, pw);
      router.push(returnPath());
    } catch (e2) {
      setErr(authErrorJa(e2));
      setBusy(false);
    }
  }

  // ---- guest：新しいメールをリンク（uid維持でデータ引き継ぎ） ----
  async function submitLink(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!EMAIL_RE.test(email.trim())) {
      setErr("メールアドレスを入力してください");
      return;
    }
    if (pw.length < 6) {
      setErr("パスワードは6文字以上にしてください");
      return;
    }
    setBusy(true);
    try {
      await linkGuestToEmail(email, pw);
      await refreshAccount();
      setMsg("確認メールを送りました。メール内のリンクを開いて認証してください。");
    } catch (e2) {
      const code = (e2 as { code?: string })?.code ?? "";
      if (code === "auth/email-already-in-use" || code === "auth/credential-already-in-use") {
        // 既存アカウントのメール：統合フローへ切り替える
        setGuestTab("merge");
        setErr("このメールアドレスは登録済みです。ログインしてゲストデータを統合してください。");
      } else {
        setErr(authErrorJa(e2));
      }
    } finally {
      setBusy(false);
    }
  }

  // ---- guest：既存アカウントへログインして統合 ----
  async function runMerge(guestToken: string, keepIds?: number[]) {
    const cur = auth.currentUser;
    if (!cur) throw new Error("no-auth");
    const idToken = await cur.getIdToken();
    const res = await fetch(MERGE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(keepIds ? { guestToken, keepIds } : { guestToken }),
    });
    if (res.status === 409) {
      // 枠不足：自動で捨てず、引き継ぐ作品を選んでもらう
      const j = (await res.json()) as {
        cap: number;
        free: number;
        memberCount: number;
        guestOnly: GuestOnlyWork[];
      };
      setMerge({
        guestToken,
        cap: j.cap,
        free: j.free,
        memberCount: j.memberCount,
        guestOnly: j.guestOnly,
        selected: j.guestOnly.slice(0, Math.max(0, j.free)).map((w) => w.id),
      });
      return false;
    }
    if (!res.ok) throw new Error("merge-failed");
    const j = (await res.json()) as { added?: number };
    setMerge(null);
    setMsg(`統合が完了しました（ゲストから${j.added ?? 0}件を引き継ぎ）。`);
    setTimeout(() => router.push("/"), 1200);
    return true;
  }

  async function submitMergeLogin(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const guest = auth.currentUser;
    if (!guest || !guest.isAnonymous) {
      setErr("ゲスト状態を確認できませんでした。ページを再読み込みしてください。");
      return;
    }
    if (pw.length < 6) {
      setErr("パスワードは6文字以上にしてください");
      return;
    }
    setBusy(true);
    try {
      // 1. ログイン前にゲストのIDトークンを保持（統合まで使う）
      const guestToken = await guest.getIdToken();
      // 2. 既存メールアカウントへログイン（uidが切り替わる）
      await signIn(email, pw);
      // 3〜6. サーバー側で検証・統合。成功時だけゲストデータが削除される
      await runMerge(guestToken);
      await refreshAccount();
    } catch (e2) {
      setErr(
        (e2 as Error)?.message === "merge-failed"
          ? "統合に失敗しました。ゲストデータは削除されていません。時間をおいて再度お試しください。"
          : authErrorJa(e2)
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitMergeSelection() {
    if (!merge || busy) return;
    if (merge.selected.length < merge.guestOnly.length) {
      const drop = merge.guestOnly.length - merge.selected.length;
      if (
        !window.confirm(
          `選ばなかった${drop}件は引き継がれません。引き継がない作品はゲストデータ削除後に復元できません。続けますか？`
        )
      )
        return;
    }
    setBusy(true);
    setErr(null);
    try {
      await runMerge(merge.guestToken, merge.selected);
      await refreshAccount();
    } catch {
      setErr("統合に失敗しました。ゲストデータは削除されていません。時間をおいて再度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  // ---- 入力フォーム共通部品 ----
  const emailInput = (
    <>
      <label className="block text-xs font-bold text-black/50">メールアドレス</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        placeholder="例）you@example.com"
        className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-[#C2772A]"
      />
    </>
  );
  const pwInput = (withMeter: boolean) => (
    <>
      <div className="mt-4 flex items-center justify-between">
        <label className="block text-xs font-bold text-black/50">パスワード</label>
        <button type="button" onClick={() => setShowPw((v) => !v)} className="text-[11px] font-bold text-[#C2772A]">
          {showPw ? "隠す" : "表示"}
        </button>
      </div>
      <input
        type={showPw ? "text" : "password"}
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="6文字以上（8文字以上を推奨）"
        className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-[#C2772A]"
      />
      {withMeter && (
        <>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-1.5 flex-1 rounded-full"
                  style={{ background: i < score ? PW_COLOR[score] : "#ECECF2" }}
                />
              ))}
            </div>
            {pw && <span className="text-[11px] font-bold" style={{ color: PW_COLOR[score] }}>{PW_LABEL[score]}</span>}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setPw(generatePw());
                setShowPw(true);
              }}
              className="rounded-full bg-[#F6E9D5] px-3 py-1 text-[11px] font-bold text-[#C2772A]"
            >
              🔒 強いパスワードを生成
            </button>
            <span className="text-[10px] text-black/40">生成後はメモ/パスワード管理アプリに保存を</span>
          </div>
        </>
      )}
    </>
  );
  const feedback = (
    <>
      {err && <p className="mt-3 text-xs text-red-600">{err}</p>}
      {msg && <p className="mt-3 text-xs text-[#059669]">{msg}</p>}
    </>
  );

  // ================= member / legacy =================
  if (accountType === "member" || accountType === "legacy") {
    return (
      <main className="mx-auto max-w-md px-4 py-10 text-center">
        <Mascot pose="cheer" h={110} />
        <h1 className="mt-3 text-xl font-extrabold text-[#1C1C2E]">ログイン済みです</h1>
        <p className="mt-2 text-sm text-black/60">このままアニミルをお楽しみください。</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/" className="rounded-full bg-[#C2772A] px-4 py-2 text-sm font-bold text-white">マイリストへ</Link>
          <Link href="/settings" className="rounded-full border border-[#C2772A] px-4 py-2 text-sm font-bold text-[#C2772A]">設定へ</Link>
        </div>
      </main>
    );
  }

  // ================= pending（メール確認待ち） =================
  if (accountType === "pending") {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <div className="mb-4 flex justify-center">
          <Mascot pose="device" h={110} />
        </div>
        <h1 className="text-xl font-extrabold text-[#1C1C2E]">メール確認待ち</h1>
        <div className="mt-4 rounded-2xl border border-[#ECECF2] bg-white p-5">
          <p className="text-sm leading-relaxed text-[#6B7280]">
            <span className="font-bold text-[#1C1C2E]">{user?.email}</span> 宛の確認メールのリンクを開いて認証してください。
            認証が完了するまで登録枠は{GUEST_SLOTS}件のままです。認証後に{MEMBER_BASE_SLOTS}件へ増えます。
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setChecked(false);
              try {
                await refreshAccount();
                setChecked(true);
              } finally {
                setBusy(false);
              }
            }}
            className="mt-4 w-full rounded-xl bg-[#C2772A] py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? "確認中…" : "認証を確認する"}
          </button>
          {checked && (
            <p className="mt-2 text-xs text-[#DC2626]">まだ認証を確認できませんでした。メールのリンクを開いてから再度お試しください。</p>
          )}
          <button
            type="button"
            onClick={async () => {
              try {
                await resendVerification();
                setMsg("確認メールを再送しました。迷惑メールフォルダもご確認ください。");
              } catch {
                setErr("再送に失敗しました。しばらくして再度お試しください。");
              }
            }}
            className="mt-2 w-full rounded-xl border border-[#ECECF2] bg-white py-3 text-sm font-bold text-[#C2772A]"
          >
            確認メールを再送する
          </button>
          {feedback}
        </div>
      </main>
    );
  }

  // ================= guest（ゲスト利用中） =================
  if (isGuest) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <div className="mb-4 flex justify-center">
          <Mascot pose="point" h={110} />
        </div>
        <h1 className="text-xl font-extrabold text-[#1C1C2E]">ゲスト利用中</h1>
        <p className="mt-1 text-sm text-black/60">
          現在の登録：{guestCount != null ? `${guestCount}/${GUEST_SLOTS}件` : `最大${GUEST_SLOTS}件`}。
          メール登録すると{MEMBER_BASE_SLOTS}件、ログインボーナスで最大{MEMBER_MAX_SLOTS}件になります。
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setGuestTab("link")}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-bold ${guestTab === "link" ? "bg-[#C2772A] text-white" : "bg-[#F6E9D5] text-[#C2772A]"}`}
          >
            メール登録（引き継ぎ）
          </button>
          <button
            type="button"
            onClick={() => setGuestTab("merge")}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-bold ${guestTab === "merge" ? "bg-[#C2772A] text-white" : "bg-[#F6E9D5] text-[#C2772A]"}`}
          >
            既存アカウントへログイン
          </button>
        </div>

        {merge ? (
          <div className="mt-4 rounded-2xl border border-[#ECECF2] bg-white p-5">
            <h2 className="text-sm font-extrabold text-[#1C1C2E]">引き継ぐ作品を選んでください</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">
              アカウントの登録枠（{merge.cap}件）に対して空きが{merge.free}件のため、ゲストの作品から引き継ぐものを選択してください。
              既存アカウントの{merge.memberCount}件はそのまま維持されます。
            </p>
            <ul className="mt-3 space-y-1">
              {merge.guestOnly.map((w) => {
                const on = merge.selected.includes(w.id);
                const disable = !on && merge.selected.length >= merge.free;
                return (
                  <li key={w.id}>
                    <label className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm ${disable ? "opacity-40" : ""}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={disable}
                        onChange={() =>
                          setMerge((m) =>
                            m
                              ? {
                                  ...m,
                                  selected: on
                                    ? m.selected.filter((x) => x !== w.id)
                                    : [...m.selected, w.id],
                                }
                              : m
                          )
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{w.title}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] text-[#DC2626]">
              選択：{merge.selected.length}/{merge.free}件。引き継がない作品はゲストデータ削除後に復元できません。
            </p>
            <button
              type="button"
              onClick={submitMergeSelection}
              disabled={busy}
              className="mt-3 w-full rounded-xl bg-[#C2772A] py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? "統合中…" : "この内容で統合する"}
            </button>
            {feedback}
          </div>
        ) : guestTab === "link" ? (
          <form onSubmit={submitLink} className="mt-4 rounded-2xl border border-[#ECECF2] bg-white p-5">
            <p className="mb-3 text-xs leading-relaxed text-[#6B7280]">
              いまのゲストデータ（作品・視聴状況・通知設定）をそのまま引き継いでメール登録します。
            </p>
            {emailInput}
            {pwInput(true)}
            {feedback}
            <button
              type="submit"
              disabled={busy}
              className="mt-5 w-full rounded-xl bg-[#C2772A] py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? "処理中…" : "ゲストデータを引き継いでメール登録"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitMergeLogin} className="mt-4 rounded-2xl border border-[#ECECF2] bg-white p-5">
            <p className="mb-3 text-xs leading-relaxed text-[#6B7280]">
              すでにアニミルのアカウントをお持ちの場合はこちら。ログイン後、いまのゲストデータを安全に統合します。
            </p>
            {emailInput}
            {pwInput(false)}
            {feedback}
            <button
              type="submit"
              disabled={busy}
              className="mt-5 w-full rounded-xl bg-[#C2772A] py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? "処理中…" : "ログインして統合する"}
            </button>
          </form>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-black/50">
          ゲストデータはこのブラウザに保存された匿名IDと結び付いています。ブラウザデータの削除や端末変更で利用できなくなる場合があるため、メール登録での保護をおすすめします。
        </p>
      </main>
    );
  }

  // ================= visitor（未ログイン） =================
  const title = mode === "signup" ? "新規登録" : mode === "reset" ? "パスワード再設定" : "ログイン";
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="mb-4 flex justify-center">
        <Mascot pose="wave" h={110} />
      </div>
      <h1 className="text-2xl font-extrabold text-[#1C1C2E]">{title}</h1>

      <form onSubmit={submit} className="mt-6 rounded-2xl border border-[#ECECF2] bg-white p-5">
        {emailInput}
        {mode !== "reset" && pwInput(mode === "signup")}
        {feedback}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-[#C2772A] py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? "処理中…" : mode === "signup" ? "新規登録する" : mode === "reset" ? "再設定メールを送る" : "ログインする"}
        </button>

        {mode === "login" && (
          <div className="mt-3 flex items-center justify-between text-xs font-semibold text-[#C2772A]">
            <button type="button" onClick={() => switchMode("signup")}>新規登録はこちら</button>
            <button type="button" onClick={() => switchMode("reset")}>パスワードをお忘れですか？</button>
          </div>
        )}
        {mode !== "login" && (
          <button type="button" onClick={() => switchMode("login")} className="mt-3 w-full text-center text-xs font-semibold text-[#C2772A]">
            ← ログインに戻る
          </button>
        )}
      </form>

      <div className="mt-3 rounded-2xl bg-[#FBF3E6] px-4 py-3 text-xs leading-relaxed text-[#6B7280]">
        <p className="font-bold text-[#C2772A]">登録なしでも{GUEST_SLOTS}作品まで使えます</p>
        <p className="mt-1">
          作品詳細で「通知登録」を押すと自動でゲスト利用が始まります。メール登録すると{MEMBER_BASE_SLOTS}件、
          ログインボーナスで最大{MEMBER_MAX_SLOTS}件まで増え、端末を変えてもデータを引き継げます。
        </p>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-black/50">
        メールアドレスとパスワードで登録できます。登録後は確認メールのリンクを開いて認証してください。
        {mode === "login" && "（以前IDで登録した方は、そのIDでもログインできます）"}
      </p>
    </main>
  );
}
