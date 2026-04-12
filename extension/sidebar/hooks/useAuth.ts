import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { createSupabaseClient } from "../utils/supabase";

const TOKEN_KEY = "memorey_access_token";

export interface AuthContextValue {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  isReady: boolean;
  error: string | null;
  connect: (token: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthContext.Provider");
  return ctx;
}

export function useAuth(): AuthContextValue {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  const validateToken = useCallback(
    async (t: string): Promise<{ valid: boolean; userId?: string }> => {
      const trimmed = t.trim();
      if (!trimmed) return { valid: false };

      const client = createSupabaseClient(trimmed);
      if (!client) return { valid: false };

      try {
        const {
          data: { user },
          error: authErr,
        } = await client.auth.getUser();
        if (authErr || !user) return { valid: false };
        return { valid: true, userId: user.id };
      } catch {
        return { valid: false };
      }
    },
    []
  );

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      const saved = await chromeStorageGet(TOKEN_KEY);
      if (!saved) {
        setIsReady(true);
        return;
      }

      const result = await validateToken(saved);
      if (result.valid && result.userId) {
        setToken(saved);
        setUserId(result.userId);
        setIsAuthenticated(true);
      } else {
        await chromeStorageSet(TOKEN_KEY, "");
      }
      setIsReady(true);
    })();
  }, [validateToken]);

  const connect = useCallback(
    async (raw: string): Promise<boolean> => {
      const trimmed = raw.trim();
      setError(null);

      const result = await validateToken(trimmed);
      if (!result.valid || !result.userId) {
        setError("Invalid or expired token. Please get a fresh token from the web app.");
        return false;
      }

      await chromeStorageSet(TOKEN_KEY, trimmed);
      setToken(trimmed);
      setUserId(result.userId);
      setIsAuthenticated(true);
      setError(null);
      return true;
    },
    [validateToken]
  );

  const disconnect = useCallback(async () => {
    await chromeStorageSet(TOKEN_KEY, "");
    setToken(null);
    setUserId(null);
    setIsAuthenticated(false);
    setError(null);
  }, []);

  return { token, userId, isAuthenticated, isReady, error, connect, disconnect };
}

function chromeStorageGet(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(key, (result) => resolve(result[key] ?? null));
    } else {
      resolve(localStorage.getItem(key));
    }
  });
}

function chromeStorageSet(key: string, value: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    } else {
      localStorage.setItem(key, value);
      resolve();
    }
  });
}
