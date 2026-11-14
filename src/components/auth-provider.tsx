"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { getAuthClient } from "@/lib/auth-client";
import { clearHistoryLinkMarker, linkGuestHistory } from "@/lib/auth-flow";

export interface Account {
  id: string;
  label: string;
  provider: "demo" | "supabase";
  subject?: string;
}
interface AuthState {
  account: Account | null;
  demoAvailable: boolean;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required.");
  return value;
}

export function AuthProvider({ children, initialDemoAvailable }: { children: ReactNode; initialDemoAvailable: boolean }) {
  const pathname = usePathname();
  const [account, setAccount] = useState<Account | null>(null);
  const [demoAvailable, setDemoAvailable] = useState(initialDemoAvailable);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [saving, setSaving] = useState(false);
  const currentAccount = useRef<Account | null | undefined>(undefined);
  const requestNumber = useRef(0);
  const currentPath = useRef(pathname);
  currentPath.current = pathname;

  const refresh = useCallback(async () => {
    const sequence = ++requestNumber.current;
    setLoading(true);
    setError("");
    try {
      const result = await api<{ account: Account | null; demoAvailable: boolean }>("/api/auth/me");
      if (sequence !== requestNumber.current) return;
      const previous = currentAccount.current;
      // Reload private views on identity changes, including changes in another tab.
      if (previous && previous.id !== result.account?.id && !["/login", "/auth/callback"].includes(currentPath.current)) {
        window.location.replace("/");
        return;
      }
      currentAccount.current = result.account;
      setAccount(result.account);
      setDemoAvailable(result.demoAvailable);
    } catch {
      if (sequence !== requestNumber.current) return;
      setAccount(null);
      setError("Не удалось проверить аккаунт. Повторите попытку.");
    } finally {
      if (sequence === requestNumber.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void refresh();
    const client = getAuthClient();
    const subscription = client?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearHistoryLinkMarker();
        if (!["/login", "/auth/callback"].includes(currentPath.current)) {
          window.location.replace("/");
          return;
        }
      }
      // Supabase holds its auth lock while notifying listeners.
      setTimeout(() => { if (active) void refresh(); }, 0);
    }).data.subscription;
    const onStorage = (event: StorageEvent) => {
      if (event.key === "businesscup26.auth-change") window.location.replace("/");
    };
    const onFocus = () => { if (active) void refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      requestNumber.current += 1;
      subscription?.unsubscribe();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const saveHistory = useCallback(async (subject: string) => {
    setSaving(true);
    setHistoryError("");
    try {
      await linkGuestHistory(subject);
    } catch {
      setHistoryError("Не удалось перенести гостевые занятия. Они сохранены в этом браузере — попробуйте ещё раз.");
    } finally { setSaving(false); }
  }, []);

  useEffect(() => {
    if (account?.provider === "supabase" && account.subject && !["/login", "/auth/callback"].includes(pathname)) {
      void saveHistory(account.subject);
    }
  }, [account?.id, account?.provider, account?.subject, pathname, saveHistory]);

  return (
    <AuthContext.Provider value={{ account, demoAvailable, loading, error, refresh }}>
      {children}
      {account?.provider === "supabase" && !["/login", "/auth/callback"].includes(pathname) && (saving || historyError) && (
        <div className="account-history-notice" lang="ru">
          {saving ? <p role="status">Сохраняем гостевые занятия в аккаунт…</p> : (
            <div className="notice error" role="alert"><p>{historyError}</p><button className="secondary" onClick={() => account.subject && void saveHistory(account.subject)}>Повторить перенос</button></div>
          )}
        </div>
      )}
    </AuthContext.Provider>
  );
}
