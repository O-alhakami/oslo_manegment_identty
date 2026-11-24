import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createSalt,
  decodeSalt,
  deriveKeys,
  encodeSalt,
} from "../utils/crypto";
import { apiRequest } from "../utils/api";

interface AuthResponse {
  token: string;
}

interface SaltResponse {
  salt: string;
}

interface AuthContextValue {
  token: string | null;
  encryptionKey: CryptoKey | null;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    setToken(null);
    setEncryptionKey(null);
  }, []);

  useEffect(() => {
    window.addEventListener("session-expired", logout);
    return () => window.removeEventListener("session-expired", logout);
  }, [logout]);

  const authenticate = useCallback(
    async (operation: "login" | "register", emailInput: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const email = emailInput.trim().toLowerCase();
        let salt: Uint8Array<ArrayBuffer>;
        if (operation === "register") {
          salt = createSalt();
        } else {
          const response = await apiRequest<SaltResponse>(
            `/api/auth/salt/${encodeURIComponent(email)}`,
          );
          salt = decodeSalt(response.salt);
        }

        const derived = await deriveKeys(password, salt);
        const response = await apiRequest<AuthResponse>(
          `/api/auth/${operation}`,
          {
            method: "POST",
            body: JSON.stringify(
              operation === "register"
                ? {
                    email,
                    auth_key: derived.authKey,
                    kdf_salt: encodeSalt(salt),
                  }
                : { email, auth_key: derived.authKey },
            ),
          },
        );
        setToken(response.token);
        setEncryptionKey(derived.encryptionKey);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "تعذر تسجيل الدخول. حاول مرة أخرى.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const login = useCallback(
    (email: string, password: string) => authenticate("login", email, password),
    [authenticate],
  );
  const register = useCallback(
    (email: string, password: string) =>
      authenticate("register", email, password),
    [authenticate],
  );
  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      token,
      encryptionKey,
      loading,
      error,
      clearError,
      login,
      register,
      logout,
    }),
    [token, encryptionKey, loading, error, clearError, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
