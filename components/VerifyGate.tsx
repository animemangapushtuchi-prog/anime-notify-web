"use client";

// メール確認バナー。実メールで未認証（pending）のユーザーに、サイトを塞がず上部で認証を促す。
// 匿名ゲスト・旧IDアカウントには表示しない。
import { useState, type ReactNode } from "react";
import { useAuth, needsVerification, resendVerification } from "@/lib/auth";

export default function VerifyGate({ children }: { children: ReactNode }) {
  const { user, loading, refreshAccount } = useAuth();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  if (loading || !needsVerification(user)) return <>{children}</>;

  return (
    <>
      <div className="border-b border-[#F3D9A9] bg-[#FBF3E6] px-4 py-2.5">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="min-w-0 flex-1 text-xs leading-snug text-[#1C1C2E]">
            📧 <span className="font-bold">メール確認待ち：</span>
            {user?.email} 宛の確認メールのリンクを開いてください。認証まで登録枠は5件です。
          </p>
          <div className="flex flex-none items-center gap-2">
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
              className="rounded-full bg-[#C2772A] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
            >
              {busy ? "確認中…" : "認証を確認"}
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
              className="rounded-full border border-[#C2772A] bg-white px-3 py-1.5 text-[11px] font-bold text-[#C2772A]"
            >
              再送
            </button>
          </div>
          {sent && <p className="w-full text-[11px] text-[#059669]">確認メールを再送しました。迷惑メールフォルダもご確認ください。</p>}
          {checked && needsVerification(user) && (
            <p className="w-full text-[11px] text-[#DC2626]">まだ認証を確認できませんでした。メールのリンクを開いてから再度お試しください。</p>
          )}
        </div>
      </div>
      {children}
    </>
  );
}
