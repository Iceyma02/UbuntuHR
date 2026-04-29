import { createContext, useContext, useState, useEffect } from "react";
import { getMe } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("zimhr_token");
    if (token) {
      getMe()
        .then(res => { setUser(res.data); setCompany(res.data.company); })
        .catch(() => localStorage.removeItem("zimhr_token"))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    localStorage.setItem("zimhr_token", token);
    setUser(userData);
    setCompany(userData.company);
  };

  const logout = () => {
    localStorage.removeItem("zimhr_token");
    setUser(null);
    setCompany(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, company, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
