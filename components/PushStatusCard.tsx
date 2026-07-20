"use client";

// 設定画面「この端末の通知状態」カード。
// 状態診断・有効化・端末内表示テスト・再設定・端末別の案内をここに集約する
// （設定画面ではこのカードが EnablePush の後継。EnablePush は作品詳細側で引き続き使用）。
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  diagnosePush,
  requestAndRegisterPush,
  resetPush,
  showLocalTestNotification,
  type PushDiagnosis,
} from "@/lib/fcm";

type Busy = "enable" | "reset" | "test" | null;
type Device = "ios" | "android" | "pc";

// User-Agentからの推定（断定はせず「お使いの端末では」の補助案内に使う）
function detectDevice(): Device {
  if (typeof navigator === "undefined") return "pc";
  const ua = navigator.userAgent;
  const iosLike =
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
  if (iosLike) return "ios";
  if (/Android/.test(ua)) return "android";
  return "pc";
}

// ホーム画面追加（スタンドアロン）起動かどうか
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)")?.matches === true || nav.standalone === true;
}

// 診断項目1行（アイコン＋文言で状態を示し、色だけに依存しない）
function Row({ label, mark, text }: { label: string; mark: "ok" | "warn" | "ng" | "none"; text: string }) {
  const icon = mark === "ok" ? "✓" : mark === "warn" ? "！" : mark === "ng" ? "✕" : "－";
  const color =
    mark === "ok" ? "text-emerald-600" : mark === "warn" ? "text-[#C2772A]" : mark === "ng" ? "text-[#DC2626]" : "text-black/40";
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-xs">
      <span className="text-black/60">{label}</span>
      <span className={`font-bold ${color}`}>
        {icon} {text}
      </span>
    </li>
  );
}

const BTN = "rounded-xl bg-[#C2772A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60";

export default function PushStatusCard({ appEnabled }: { appEnabled: boolean | null }) {
  const { user } = useAuth();
  const [diag, setDiag] = useState<PushDiagnosis | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>("pc");
  const [standalone, setStandalone] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    // 診断は許可ダイアログを出さない（許可済みのときだけトークン確認を行う）
    setDiag(await diagnosePush(user.uid));
  }, [user]);

  useEffect(() => {
    setDevice(detectDevice());
    setStandalone(isStandalone());
    refresh();
  }, [refresh]);

  if (!user) return null;

  const enable = async () => {
    if (busy) return;
    setBusy("enable");
    setNotice(null);
    const r = await requestAndRegisterPush(user.uid);
    if (r === "enabled") setNotice("ブラウザ通知を有効にしました。");
    else if (r === "denied") setNotice("通知が許可されませんでした。許可すると新着通知を受け取れます。");
    else setNotice("設定できませんでした。時間をおいて再度お試しください。");
    await refresh();
    setBusy(null);
  };

  const reset = async () => {
    if (busy) return;
    setBusy("reset");
    setNotice(null);
    const r = await resetPush(user.uid);
    setNotice(
      r === "enabled"
        ? "通知を再設定しました。"
        : "再設定できませんでした。時間をおいて再度お試しいただくか、下の端末別の案内をご確認ください。"
    );
    await refresh();
    setBusy(null);
  };

  const test = async () => {
    if (busy) return;
    setBusy("test");
    setNotice(null);
    const r = await showLocalTestNotification();
    if (r === "shown") setNotice("テスト通知を表示しました。見えない場合はOS側の通知設定（集中モードなど）もご確認ください。");
    else if (r === "blocked") setNotice("ブラウザで通知がブロックされているため、テスト通知を表示できません。");
    else setNotice("テスト通知を表示できませんでした。「通知を再設定」をお試しください。");
    await refresh();
    setBusy(null);
  };

  // 総合状態（端末の準備＋アプリ内通知設定の両方がそろって「準備完了」）
  const overall = !diag
    ? { icon: "…", text: "状態を確認中…", cls: "text-black/50" }
    : diag.status === "ready" && appEnabled === false
      ? { icon: "⏸", text: "端末の準備はできていますが、アプリ内の通知設定がOFFのため通知は停止中です", cls: "text-[#C2772A]" }
      : diag.status === "ready"
        ? { icon: "✓", text: "通知を受け取る準備ができています", cls: "text-emerald-600" }
        : diag.status === "permission-required"
          ? { icon: "！", text: "通知の許可が必要です", cls: "text-[#C2772A]" }
          : diag.status === "blocked"
            ? { icon: "✕", text: "ブラウザで通知がブロックされています", cls: "text-[#DC2626]" }
            : diag.status === "error"
              ? { icon: "！", text: "通知の登録に失敗しています", cls: "text-[#DC2626]" }
              : { icon: "－", text: "この環境ではブラウザ通知を利用できません", cls: "text-black/50" };

  const showGuide =
    !!diag &&
    (diag.status === "blocked" ||
      diag.status === "unsupported" ||
      diag.status === "error" ||
      (device === "ios" && !standalone && diag.status !== "ready"));

  return (
    <div className="mt-4 rounded-2xl border border-[#ECECF2] bg-white p-4">
      <h2 className="mb-1 text-xs font-bold text-black/50">🔔 この端末の通知状態</h2>

      {/* 総合状態と操作結果（スクリーンリーダーにも伝える） */}
      <div aria-live="polite">
        <p className={`text-sm font-bold ${overall.cls}`}>
          {overall.icon} {overall.text}
        </p>
        {notice && <p className="mt-1 text-[11px] leading-snug text-black/60">{notice}</p>}
      </div>

      {diag && (
        <ul className="mt-2 border-t border-black/5">
          <Row
            label="ブラウザ対応"
            mark={diag.supported ? "ok" : "none"}
            text={diag.supported ? "利用可能" : "非対応"}
          />
          <Row
            label="通知の許可"
            mark={diag.permission === "granted" ? "ok" : diag.permission === "denied" ? "ng" : diag.permission === "default" ? "warn" : "none"}
            text={
              diag.permission === "granted"
                ? "許可済み"
                : diag.permission === "denied"
                  ? "ブロック中"
                  : diag.permission === "default"
                    ? "未選択"
                    : "－"
            }
          />
          <Row
            label="この端末の登録"
            mark={diag.tokenRegistered ? "ok" : diag.status === "error" ? "ng" : "none"}
            text={diag.tokenRegistered ? "登録済み" : diag.status === "error" ? "確認失敗" : "未登録"}
          />
          <Row
            label="アプリ内通知"
            mark={appEnabled === null ? "none" : appEnabled ? "ok" : "warn"}
            text={appEnabled === null ? "確認中" : appEnabled ? "ON" : "OFF"}
          />
        </ul>
      )}

      {/* 状態に応じた操作 */}
      <div className="mt-3 space-y-2">
        {diag?.status === "permission-required" && (
          <button type="button" onClick={enable} disabled={busy !== null} className={BTN}>
            {busy === "enable" ? "設定中…" : "🔔 ブラウザ通知を有効にする"}
          </button>
        )}
        {diag?.status === "ready" && (
          <>
            <button type="button" onClick={test} disabled={busy !== null} className={BTN}>
              {busy === "test" ? "テスト中…" : "この端末で表示テスト"}
            </button>
            <p className="text-[10px] leading-snug text-black/40">
              ※ この端末内で通知を表示できるかのテストです。新話などの定期通知（サーバーからの配信）のテストではありません。
            </p>
          </>
        )}
        {diag?.status === "error" && (
          <button type="button" onClick={reset} disabled={busy !== null} className={BTN}>
            {busy === "reset" ? "再設定中…" : "通知を再設定"}
          </button>
        )}
        {diag?.status === "blocked" && (
          <p className="text-[11px] leading-snug text-black/60">
            ブラウザのサイト設定（アドレスバー付近のサイト情報アイコン）から、このサイトの通知を「許可」に変更してください。変更後にこのページを開き直すと反映されます。
          </p>
        )}
        {diag?.status === "ready" && appEnabled === false && (
          <p className="text-[11px] leading-snug text-[#C2772A]">
            下の「🔔 通知」にある「通知を受け取る」をONにすると、通知が再開されます。
          </p>
        )}
      </div>

      {/* 問題があるときだけ端末別の案内を出す */}
      {showGuide && (
        <details className="mt-3 rounded-xl bg-[#FBF3E6] px-3 py-2">
          <summary className="cursor-pointer text-xs font-bold text-[#C2772A]">お使いの端末での対処方法</summary>
          <div className="mt-2 space-y-1 text-[11px] leading-relaxed text-black/70">
            {device === "ios" && (
              <>
                {!standalone && <p>・Safariの共有メニューから「ホーム画面に追加」し、ホーム画面のアニミルから起動して通知を有効にしてください。</p>}
                <p>・通知を拒否した場合は、iOSの「設定」→「通知」（またはホーム画面に追加したアニミル）から通知を許可し直してください。</p>
              </>
            )}
            {device === "android" && (
              <>
                <p>・Chromeのメニュー→「サイト設定」→「通知」で、このサイトを許可してください。</p>
                <p>・Android本体の設定で、Chrome（またはインストールしたアニミル）の通知が許可されているかもご確認ください。</p>
              </>
            )}
            {device === "pc" && (
              <>
                <p>・アドレスバー付近のサイト情報アイコン（鍵や設定のマーク）から、通知を「許可」にしてください。</p>
                <p>・Windows／macOS側の通知設定（集中モード・おやすみモードなど）もご確認ください。</p>
              </>
            )}
          </div>
        </details>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-black/50">
        有効にすると、この端末に新話・配信入りのブラウザ通知が届きます。ログアウトすると、この端末への通知は止まります。
      </p>
    </div>
  );
}
