"use client";

// メール認証ゲート。実メールで未認証のユーザーには、認証を促す画面を出して先に進ませない。
import { useState, type ReactNode } from "react";
import { useAuth, needsVerification, resendVerification, logout } from "@/lib/auth";
import { auth } from "@/lib/firebase";

export default function VerifyGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading || !needsVerification(user)) return <>{children}</>;

  return (
    <main className="mx-auto max-w-md px-4 py-14 text-center">
      <div className="text-4xl">📧</div>
      <h1 className="mt-3 text-xl font-extrabold text-[#1C1C2E]">メール認証をお願いします</h1>
      <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
        <span className="font-bold text-[#1C1C2E]">{user?.email}</span> に確認メールを送りました。
        メール内のリンクを開いて認証を完了すると、アプリが使えるようになります。
      </p>

      <div className="mt-6 space-y-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await auth.currentUser?.reload();
              window.location.reload();
            } finally {
              setBusy(false);
            }
          }}
          className="w-full rounded-xl bg-[#5B4FCF] py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? "確認中…" : "認証しました（再読み込み）"}
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              await resendVerification();
              setSent(true);
            } catch {
              /* noop */
            }
          }}
          className="w-full rounded-xl border border-[#ECECF2] bg-white py-3 text-sm font-bold text-[#5B4FCF]"
        >
          確認メールを再送する
        </button>
        {sent && <p className="text-xs text-[#059669]">再送しました。メールをご確認ください。</p>}
        <button type="button" onClick={() => logout()} className="w-full py-2 text-xs font-semibold text-[#6B7280]">
          別のアカウントでログイン（ログアウト）
        </button>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-black/40">
        メールが届かない場合は、迷惑メールフォルダもご確認ください。
      </p>
    </main>
  );
}
