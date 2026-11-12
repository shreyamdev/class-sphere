import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  loginRequest,
  googleAuthRequest,
  fetchMe,
  logoutRequest,
} from "../services/authService";
import { tokenStorage } from "../services/tokenStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const authRequestId = useRef(0);

  useEffect(() => {
    let ignore = false;
    const requestId = authRequestId.current;
    fetchMe()
      .then((me) => {
        if (!ignore && requestId === authRequestId.current) setUser(me);
      })
      .catch(() => {
        if (!ignore && requestId === authRequestId.current) setUser(null);
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
      setUser(null);
    };
    window.addEventListener("classesphere:session-expired", onExpired);
    return () => window.removeEventListener("classesphere:session-expired", onExpired);
  }, []);

  const startSession = (session) => {
    if (session.tokens) {
      tokenStorage.set(session.tokens);
    } else {
      tokenStorage.clear();
    }
    setUser(session.user);
    return session.user;
  };

  const login = async (credentials, role) => {
    authRequestId.current += 1;
    const session = await loginRequest({ ...credentials, role });
    return startSession(session);
  };

  const loginWithGoogle = async (idToken, role) => {
    authRequestId.current += 1;
    const session = await googleAuthRequest(idToken, role);
    return startSession(session);
  };

  const logout = async () => {
    authRequestId.current += 1;
    try {
      await logoutRequest(tokenStorage.get()?.refreshToken);
    } catch (error) {
      console.warn("Could not notify the server about logout:", error);
    } finally {
      tokenStorage.clear();
      setUser(null);
    }
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
