"use client";

// 匿名アンケート。回答にID/uid/トークンは一切含めない（ルールで書き込みのみ許可）。
// 回答済みフラグは端末のlocalStorageのみ。
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const RADIOS = {
  devices: { q: "主に使っている端末は？", opts: ["PC", "スマホ", "両方"] },
  notif: { q: "通知は届いていますか？", opts: ["届く", "届かない", "まだ設定していない"] },
  usability: { q: "使いやすさは？", opts: ["とても良い", "良い", "普通", "悪い"] },
  satisfaction: { q: "総合満足度は？", opts: ["満足", "やや満足", "普通", "不満"] },
  continueUse: { q: "使い続けたいと思いますか？", opts: ["はい", "どちらとも", "いいえ"] },
};
const FEATURES = ["マイリスト", "カレンダー", "検索", "通知", "作品詳細・配信情報"];

function RadioRow({
  name,
  q,
  opts,
  value,
  onChange,
}: {
  name: string;
  q: string;
  opts: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-[#ECECF2] bg-white p-4">
      <p className="text-sm font-bold text-[#1C1C2E]">{q}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {opts.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              value === o ? "bg-[#C2772A] text-white" : "bg-[#F6E9D5] text-[#C2772A]"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      <input type="hidden" name={name} value={value} readOnly />
    </div>
  );
}

export default function SurveyPage() {
  const [ans, setAns] = useState<Record<string, string>>({});
  const [features, setFeatures] = useState<string[]>([]);
  const [trouble, setTrouble] = useState("");
  const [wish, setWish] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: string, v: string) => setAns((p) => ({ ...p, [k]: v }));
  const toggleFeature = (f: string) =>
    setFeatures((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await addDoc(collection(db, "survey"), {
        devices: ans.devices ?? "",
        notif: ans.notif ?? "",
        usability: ans.usability ?? "",
        satisfaction: ans.satisfaction ?? "",
        continueUse: ans.continueUse ?? "",
        features,
        trouble,
        wish,
        at: serverTimestamp(),
        ver: "web-1",
      });
      try {
        window.localStorage.setItem("surveyed", "1");
      } catch {}
      setDone(true);
    } catch {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-2xl">🙏</p>
        <p className="mt-2 text-lg font-extrabold text-[#1C1C2E]">ご協力ありがとうございました！</p>
        <p className="mt-1 text-sm text-black/60">いただいた感想は次の改善に活かします。</p>
        <Link href="/" className="mt-5 inline-block rounded-full bg-[#C2772A] px-5 py-2.5 text-sm font-bold text-white">
          ホームへ
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="text-2xl font-extrabold text-[#1C1C2E]">📝 ベータ版アンケート</h1>
      <p className="mt-1 text-sm text-black/60">匿名・1分で終わります。感想が次のアップデートに直結します。</p>

      <form onSubmit={submit} className="mt-4 space-y-3">
        {Object.entries(RADIOS).map(([k, v]) => (
          <RadioRow key={k} name={k} q={v.q} opts={[...v.opts]} value={ans[k] ?? ""} onChange={(x) => set(k, x)} />
        ))}

        <div className="rounded-2xl border border-[#ECECF2] bg-white p-4">
          <p className="text-sm font-bold text-[#1C1C2E]">よく使う機能は？（複数可）</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FEATURES.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => toggleFeature(f)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  features.includes(f) ? "bg-[#C2772A] text-white" : "bg-[#F6E9D5] text-[#C2772A]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#ECECF2] bg-white p-4">
          <p className="text-sm font-bold text-[#1C1C2E]">困ったこと・不具合があれば</p>
          <textarea
            value={trouble}
            onChange={(e) => setTrouble(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-[#ECECF2] p-2 text-sm outline-none focus:border-[#C2772A]"
            placeholder="自由記述（任意）"
          />
        </div>

        <div className="rounded-2xl border border-[#ECECF2] bg-white p-4">
          <p className="text-sm font-bold text-[#1C1C2E]">ほしい機能・要望</p>
          <textarea
            value={wish}
            onChange={(e) => setWish(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-[#ECECF2] p-2 text-sm outline-none focus:border-[#C2772A]"
            placeholder="自由記述（任意）"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-[#C2772A] py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? "送信中…" : "回答を送信する"}
        </button>
      </form>
    </main>
  );
}
