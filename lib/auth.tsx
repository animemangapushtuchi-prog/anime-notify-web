"use client";

// 認証基盤。メールアドレス＋パスワード方式（Firebase Auth）＋メール認証必須。
// 旧「ID→擬似メール(@user.anime-notify.app)」で登録した人も、IDを入力すれば後方互換でログイン可能。
// 旧IDアカウントは擬似メールで認証不可のため、メール認証は免除する。
// さらに「ゲスト利用」（匿名認証）に対応：最初の作品登録時にだけ匿名ユーザーを作成する。
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInAnonymously,
  linkWithCredential,
  EmailAuthProvider,
  signOut,
  type User,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { unregisterPush } from "@/lib/fcm";
import { recordLogin } from "@/lib/login";
import {
  GUEST_SLOTS,
  MEMBER_BASE_SLOTS,
  slotCapFor,
  type AccountKind,
} from "@/lib/works";

const LEGACY_DOMAIN = "@user.anime-notify.app";
export const idToEmail = (id: string) => `${id.trim().toLowerCase()}${LEGACY_DOMAIN}`;

const toAuthEmail = (idOrEmail: string) => {
  const v = idOrEmail.trim();
  return v.includes("@") ? v.toLowerCase() : idToEmail(v);
};
export const displayName = (email: string | null) => {
  const e = email ?? "";
  return e.endsWith(LEGACY_DOMAIN) ? e.replace(LEGACY_DOMAIN, "") : e;
};
// 実メールアカウントで未認証なら true（旧IDアカウント・匿名ゲストは必ず免除）
export const needsVerification = (user: User | null) =>
  !!user &&
  !user.isAnonymous &&
  !user.emailVerified &&
  !(user.email ?? "").endsWith(LEGACY_DOMAIN);

export type AccountType = AccountKind; // "visitor" | "guest" | "pending" | "member" | "legacy"

// ユーザーオブジェクトからアカウント種別を導出
export function deriveAccountType(user: User | null): AccountType {
  if (!user) return "visitor";
  if (user.isAnonymous) return "guest";
  if ((user.email ?? "").endsWith(LEGACY_DOMAIN)) return "legacy";
  return user.emailVerified ? "member" : "pending";
}

type AuthState = {
  user: User | null;
  loading: boolean;
  idLabel: string;
  accountType: AccountType;
  isGuest: boolean;
  slotCap: number;
  loginDays: number;
  loginBonusToday: boolean;
  refreshAccount: () => Promise<void>; // メール認証後などにユーザー状態を再評価
};
const AuthCtx = createContext<AuthState>({
  user: null,
  loading: true,
  idLabel: "",
  accountType: "visitor",
  isGuest: false,
  slotCap: GUEST_SLOTS,
  loginDays: 0,
  loginBonusToday: false,
  refreshAccount: async () => {},
});
export const useAuth = () => useContext(AuthCtx);

// account.kind を users/{uid} へ保存（同一セッションでの重複書き込みは避ける）
const kindWritten = new Set<string>();
async function saveAccountKind(uid: string, kind: "guest" | "pending" | "member" | "legacy") {
  const key = `${uid}:${kind}`;
  if (kindWritten.has(key)) return;
  kindWritten.add(key);
  try {
    await setDoc(
      doc(db, "users", uid),
      { account: { kind, updatedAt: serverTimestamp() } },
      { merge: true }
    );
  } catch {
    kindWritten.delete(key);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [ver, setVer] = useState(0); // user.reload()後の再評価用
  const [slots, setSlots] = useState({ days: 0, cap: MEMBER_BASE_SLOTS, gained: false });

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const accountType = deriveAccountType(user);
  const isMemberLike = accountType === "member" || accountType === "legacy";

  useEffect(() => {
    if (!user || !isMemberLike) {
      setSlots({ days: 0, cap: MEMBER_BASE_SLOTS, gained: false });
      return;
    }
    let alive = true;
    // ログインボーナスの記録はメール認証済み（member/legacy）だけ。ゲスト・確認待ちは記録しない
    recordLogin(user.uid)
      .then((r) => {
        if (alive)
          setSlots({ days: r.days, cap: r.cap, gained: r.gainedToday && r.bonus > 0 });
      })
      .catch(() => {});
    // memberになった時点で account.kind を更新（ゲスト→認証完了の反映）
    saveAccountKind(user.uid, accountType === "legacy" ? "legacy" : "member");
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isMemberLike, ver]);

  // メール認証の完了確認など、ユーザー状態を再評価したいときに呼ぶ
  const refreshAccount = useCallback(async () => {
    try {
      await auth.currentUser?.reload();
    } catch {
      /* noop */
    }
    setUser(auth.currentUser);
    setVer((v) => v + 1);
  }, []);

  // 種別ごとの上限（判定中に会員枠を誤表示しないよう、member/legacy以外は常に5）
  const slotCap = isMemberLike ? slots.cap : slotCapFor(accountType, 0);

  return (
    <AuthCtx.Provider
      value={{
        user,
        loading,
        idLabel: user?.isAnonymous ? "ゲスト利用中" : displayName(user?.email ?? null),
        accountType,
        isGuest: accountType === "guest",
        slotCap,
        loginDays: slots.days,
        loginBonusToday: slots.gained,
        refreshAccount,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

// ---- ゲスト（匿名）セッション ----
// 重要：閲覧だけでは作らない。最初の作品登録操作のときにだけ呼ぶこと。
let guestPromise: Promise<User> | null = null;
export function ensureGuestSession(): Promise<User> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (guestPromise) return guestPromise; // 同時クリックでも匿名アカウントは1つだけ
  guestPromise = (async () => {
    try {
      const cred = await signInAnonymously(auth);
      // アカウント種別を保存（失敗しても登録処理は続行可能）
      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          account: { kind: "guest", createdAt: serverTimestamp() },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
      return cred.user;
    } finally {
      guestPromise = null;
    }
  })();
  return guestPromise;
}

// ゲスト（匿名）ユーザーへ新しいメールをリンクする（uid維持でメール会員へ移行）。
// リンク後は未認証（pending）のため確認メールを送る。
export async function linkGuestToEmail(email: string, password: string) {
  const u = auth.currentUser;
  if (!u || !u.isAnonymous) throw new Error("not-guest");
  const cred = EmailAuthProvider.credential(email.trim().toLowerCase(), password);
  await linkWithCredential(u, cred);
  await saveAccountKind(u.uid, "pending");
  try {
    await sendEmailVerification(auth.currentUser!);
  } catch {
    /* 送信失敗は無視（後で再送可能） */
  }
}

// 新規登録＝メール。作成後に確認メールを送る。
export async function signUp(email: string, password: string) {
  await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  if (auth.currentUser) {
    try {
      await sendEmailVerification(auth.currentUser);
    } catch {
      /* 送信失敗は無視（後で再送可能） */
    }
  }
}
// ログイン＝メール または 旧ID（後方互換）
export async function signIn(idOrEmail: string, password: string) {
  await signInWithEmailAndPassword(auth, toAuthEmail(idOrEmail), password);
}
export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}
export async function resendVerification() {
  if (auth.currentUser) await sendEmailVerification(auth.currentUser);
}
export async function logout() {
  await unregisterPush();
  await signOut(auth);
}

export function authErrorJa(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/email-already-in-use":
    case "auth/credential-already-in-use":
      return "そのメールアドレスは既に登録されています";
    case "auth/invalid-email":
      return "メールアドレスの形式が正しくありません";
    case "auth/weak-password":
      return "パスワードは6文字以上にしてください";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "メールアドレスまたはパスワードが違います";
    case "auth/too-many-requests":
      return "試行が多すぎます。しばらくして再度お試しください";
    case "auth/network-request-failed":
      return "通信に失敗しました。接続を確認してください";
    case "auth/admin-restricted-operation":
      return "ゲスト利用が現在有効化されていません。時間をおいてお試しください";
    default:
      return "エラーが発生しました";
  }
}
