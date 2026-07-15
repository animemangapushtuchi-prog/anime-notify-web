"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp, authErrorJa } from "@/lib/auth";

const ID_RE = /^[a-zA-Z0-9_-]{3,20}$/;

export default function LoginPage() {
  const router = useRouter();
  const [isSignup, setIsSignup] = useState(false);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ID_RE.test(id.trim())) {
      setErr("IDは3〜20文字の半角英数字（_-）で入力してください");
      return;
    }
    if (pw.length < 6) {
      setErr("パスワードは6文字以上にしてください");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (isSignup) await signUp(id, pw);
      else await signIn(id, pw);
      router.push("/me");
    } catch (e2) {
      setErr(authErrorJa(e2));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-extrabold text-[#1C1C2E]">
        {isSignup ? "新規登録" : "ログイン"}
      </h1>

      <form onSubmit={submit} className="mt-6 rounded-2xl border border-[#ECECF2] bg-white p-5">
        <label className="block text-xs font-bold text-black/50">ID</label>
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="例）anime_taro"
          className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-[#5B4FCF]"
        />
        <label className="mt-4 block text-xs font-bold text-black/50">パスワード</label>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="6文字以上"
          className="mt-1.5 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none focus:border-[#5B4FCF]"
        />

        {err && <p className="mt-3 text-xs text-red-600">{err}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-[#5B4FCF] py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? "処理中…" : isSignup ? "新規登録する" : "ログインする"}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsSignup((v) => !v);
            setErr(null);
          }}
          className="mt-3 w-full text-center text-xs font-semibold text-[#5B4FCF]"
        >
          {isSignup ? "アカウントをお持ちの方はログイン" : "アカウントをお持ちでない方は新規登録"}
        </button>
      </form>

      <p className="mt-3 text-xs leading-relaxed text-black/50">
        IDは3〜20文字の半角英数字（_-）／パスワードは6文字以上。ログインすると作品の登録・通知・設定が使えます。
      </p>
    </main>
  );
}
