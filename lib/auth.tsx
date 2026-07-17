"use client";

// 認証基盤。メールアドレス＋パスワード方式（Firebase Auth）。
// 旧「ID→擬似メール(@user.anime-notify.app)」で登録した人も、IDを入力すれば後方互換でログイン可能。
import {
  createContext,
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
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { unregisterPush } from "@/lib/fcm";

const LEGACY_DOMAIN = "@user.anime-notify.app";
export const idToEmail = (id: string) => `${id.trim().toLowerCase()}${LEGACY_DOMAIN}`;

// ログイン入力：@を含めば実メール、含まなければ旧ID扱い（擬似メールに変換）
const toAuthEmail = (idOrEmail: string) => {
  const v = idOrEmail.trim();
  return v.includes("@") ? v.toLowerCase() : idToEmail(v);
};
// 表示名：旧IDアカウントはID部分、メールアカウントはメールをそのまま
export const displayName = (email: string | null) => {
  const e = email ?? "";
  return e.endsWith(LEGACY_DOMAIN) ? e.replace(LEGACY_DOMAIN, "") : e;
};

type AuthState = { user: User | null; loading: boolean; idLabel: string };
const AuthCtx = createContext<AuthState>({ user: null, loading: true, idLabel: "" });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);
  return (
    <AuthCtx.Provider value={{ user, loading, idLabel: displayName(user?.email ?? null) }}>
      {children}
    </AuthCtx.Provider>
  );
}

// 新規登録はメールアドレスで
export async function signUp(email: string, password: string) {
  await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}
// ログインはメール、または旧ID（後方互換）
export async function signIn(idOrEmail: string, password: string) {
  await signInWithEmailAndPassword(auth, toAuthEmail(idOrEmail), password);
}
// パスワード再設定メールを送る（実メールのみ有効）
export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}
export async function logout() {
  // この端末のFCMトークン登録を消してからサインアウト
  await unregisterPush();
  await signOut(auth);
}

export function authErrorJa(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/email-already-in-use":
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
    default:
      return "エラーが発生しました";
  }
}
