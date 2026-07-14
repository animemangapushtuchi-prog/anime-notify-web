"use client";

// 認証基盤。旧Flutter版と同じ「ID→擬似メール」方式を Firebase Auth JS SDK で踏襲。
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
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

const DOMAIN = "@user.anime-notify.app";
export const idToEmail = (id: string) => `${id.trim().toLowerCase()}${DOMAIN}`;
export const emailToId = (email: string | null) =>
  (email ?? "").replace(DOMAIN, "");

type AuthState = { user: User | null; loading: boolean; idLabel: string };
const AuthCtx = createContext<AuthState>({
  user: null,
  loading: true,
  idLabel: "",
});
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
    <AuthCtx.Provider
      value={{ user, loading, idLabel: emailToId(user?.email ?? null) }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export async function signUp(id: string, password: string) {
  await createUserWithEmailAndPassword(auth, idToEmail(id), password);
}
export async function signIn(id: string, password: string) {
  await signInWithEmailAndPassword(auth, idToEmail(id), password);
}
export async function logout() {
  // Phase 3 でこの端末のFCMトークン削除を追加する。今はサインアウトのみ。
  await signOut(auth);
}

export function authErrorJa(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/email-already-in-use":
      return "そのIDは既に使われています";
    case "auth/weak-password":
      return "パスワードは6文字以上にしてください";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "IDまたはパスワードが違います";
    case "auth/network-request-failed":
      return "通信に失敗しました。接続を確認してください";
    default:
      return "エラーが発生しました";
  }
}
