"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp, resetPassword, authErrorJa } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Mode = "login" | "signup" | "reset";

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

// 強いパスワードを生成（紛らわしい文字は除外）
function generatePw(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*?";
  const arr = crypto.getRandomValues(new Uint32Array(16));
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const score = pwScore(pw);

  const switchMode = (m: Mode) => {
    setMode(m);
    setErr(null);
    setMsg(null);
  };

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
      router.push("/");
    } catch (e2) {
      setErr(authErrorJa(e2));
      setBusy(false);
    }
  }

  const title = mode === "signup" ? "新規登録" : mode === "reset" ? "パスワード再設定" : "ログイン";

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-extrabold text-[#1C1C2E]">{title}</h1>

      <form onSubmit={submit} className="mt-6 rounded-2xl border border-[#ECECF2] bg-white p-5">
        <label className="block text-xs font-bold text-black/50">メールアドレス</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="例）you@example.com"
          className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-[#5B4FCF]"
        />

        {mode !== "reset" && (
          <>
            <div className="mt-4 flex items-center justify-between">
              <label className="block text-xs font-bold text-black/50">パスワード</label>
              <button type="button" onClick={() => setShowPw((v) => !v)} className="text-[11px] font-bold text-[#5B4FCF]">
                {showPw ? "隠す" : "表示"}
              </button>
            </div>
            <input
              type={showPw ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="6文字以上（8文字以上を推奨）"
              className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-[#5B4FCF]"
            />

            {mode === "signup" && (
              <>
                {/* 強度メーター */}
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
                    className="rounded-full bg-[#ECEAFD] px-3 py-1 text-[11px] font-bold text-[#5B4FCF]"
                  >
                    🔒 強いパスワードを生成
                  </button>
                  <span className="text-[10px] text-black/40">生成後はメモ/パスワード管理アプリに保存を</span>
                </div>
              </>
            )}
          </>
        )}

        {err && <p className="mt-3 text-xs text-red-600">{err}</p>}
        {msg && <p className="mt-3 text-xs text-[#059669]">{msg}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-[#5B4FCF] py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? "処理中…" : mode === "signup" ? "新規登録する" : mode === "reset" ? "再設定メールを送る" : "ログインする"}
        </button>

        {mode === "login" && (
          <div className="mt-3 flex items-center justify-between text-xs font-semibold text-[#5B4FCF]">
            <button type="button" onClick={() => switchMode("signup")}>新規登録はこちら</button>
            <button type="button" onClick={() => switchMode("reset")}>パスワードをお忘れですか？</button>
          </div>
        )}
        {mode !== "login" && (
          <button type="button" onClick={() => switchMode("login")} className="mt-3 w-full text-center text-xs font-semibold text-[#5B4FCF]">
            ← ログインに戻る
          </button>
        )}
      </form>

      <p className="mt-3 text-xs leading-relaxed text-black/50">
        メールアドレスとパスワードで登録できます。登録後は確認メールのリンクを開いて認証してください。
        {mode === "login" && "（以前IDで登録した方は、そのIDでもログインできます）"}
      </p>
    </main>
  );
}
