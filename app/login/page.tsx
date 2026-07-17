"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp, resetPassword, authErrorJa } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Mode = "login" | "signup" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
            <label className="mt-4 block text-xs font-bold text-black/50">パスワード</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="6文字以上"
              className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-[#5B4FCF]"
            />
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
            <button type="button" onClick={() => { setMode("signup"); setErr(null); setMsg(null); }}>
              新規登録はこちら
            </button>
            <button type="button" onClick={() => { setMode("reset"); setErr(null); setMsg(null); }}>
              パスワードをお忘れですか？
            </button>
          </div>
        )}
        {mode === "signup" && (
          <button
            type="button"
            onClick={() => { setMode("login"); setErr(null); setMsg(null); }}
            className="mt-3 w-full text-center text-xs font-semibold text-[#5B4FCF]"
          >
            アカウントをお持ちの方はログイン
          </button>
        )}
        {mode === "reset" && (
          <button
            type="button"
            onClick={() => { setMode("login"); setErr(null); setMsg(null); }}
            className="mt-3 w-full text-center text-xs font-semibold text-[#5B4FCF]"
          >
            ← ログインに戻る
          </button>
        )}
      </form>

      <p className="mt-3 text-xs leading-relaxed text-black/50">
        メールアドレスとパスワード（6文字以上）で登録できます。ログインすると作品の登録・通知・設定が使えます。
        {mode === "login" && "（以前にIDで登録した方は、そのIDでもログインできます）"}
      </p>
    </main>
  );
}
