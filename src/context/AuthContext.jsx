import { useEffect, useRef, useState } from "react";
import { AuthContext } from "./authContext";
import {
  loginRequest,
  googleAuthRequest,
  fetchMe,
  logoutRequest,
} from "../services/authService";

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
      setUser(null);
    };
    window.addEventListener("classesphere:session-expired", onExpired);
    return () => window.removeEventListener("classesphere:session-expired", onExpired);
  }, []);

  const startSession = (loggedInUser) => {
    setUser(loggedInUser);
    return loggedInUser;
  };

  const login = async (credentials, role) => {
    authRequestId.current += 1;
    const loggedInUser = await loginRequest({ ...credentials, role });
    return startSession(loggedInUser);
  };

  const loginWithGoogle = async (idToken, role) => {
    authRequestId.current += 1;
    const loggedInUser = await googleAuthRequest(idToken, role);
    return startSession(loggedInUser);
  };

  const logout = async () => {
    authRequestId.current += 1;
    try {
      await logoutRequest();
    } catch (error) {
      console.warn("Could not notify the server about logout:", error);
    } finally {
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
