import { createContext, useContext, useEffect, useState } from "react";
import {
  loginRequest,
  googleAuthRequest,
  fetchMe,
  logoutRequest,
} from "../services/authService";
import { tokenStorage, AUTH_EXPIRED_EVENT } from "../services/tokenStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (!tokenStorage.get()?.accessToken) return null;
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [initializing, setInitializing] = useState(
    () => Boolean(tokenStorage.get()?.accessToken)
  );

  useEffect(() => {
    if (!tokenStorage.get()?.accessToken) {
      tokenStorage.clear();
      localStorage.removeItem("user");
      localStorage.removeItem("role");
      return undefined;
    }

    let ignore = false;
    fetchMe()
      .then((me) => {
        if (!ignore && me) {

          const effectiveRole = String(me.role || "student").toLowerCase();
          const updatedUser = { ...me, role: effectiveRole };
          setUser(updatedUser);
          localStorage.setItem("role", effectiveRole);
          localStorage.setItem("user", JSON.stringify(updatedUser));
        }
      })
      .catch(() => {
        tokenStorage.clear();
        localStorage.removeItem("user");
        localStorage.removeItem("role");
        setUser(null);
      })
      .finally(() => {
        if (!ignore) setInitializing(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => {
      tokenStorage.clear();
      localStorage.removeItem("user");
      localStorage.removeItem("role");
      setUser(null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

const startSession = (authData, requestedRole) => {
    const nextUser = authData?.user || authData;
    const tokens = authData?.tokens;

    if (tokens) {
      tokenStorage.set(tokens);
    }

    const effectiveRole = String(nextUser?.role || requestedRole || "student").toLowerCase();
    const userWithRole = { ...nextUser, role: effectiveRole };

    localStorage.setItem("role", effectiveRole);
    localStorage.setItem("user", JSON.stringify(userWithRole));

    setUser(userWithRole);
    return userWithRole;
  };

  const login = async (credentials, role) => {
    const res = await loginRequest({ ...credentials, role });
    return startSession(res, role);
  };

  const loginWithGoogle = async (idToken, role) => {
    const res = await googleAuthRequest(idToken, role);
    return startSession(res, role);
  };

  const logout = async () => {
    const tokens = tokenStorage.get();
    try {
      if (tokens?.refreshToken) await logoutRequest(tokens.refreshToken);
    } catch (error) {
      console.warn("Could not notify the server about logout:", error);
    }
    tokenStorage.clear();
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    setUser(null);
  };

  const value = {
    user,
    setUser,
    initializing,
    isAuthenticated: Boolean(user),
    login,
    loginWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
