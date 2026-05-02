import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loginAction, signUpAction } from "./actions";

export type AppRole = "admin" | "cashier";

interface AuthState {
  user: any | null;
  roles: AppRole[];
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("pos_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const userData = await loginAction({ data: { email, password } });
      setUser(userData);
      localStorage.setItem("pos_user", JSON.stringify(userData));
    } catch (err: any) {
      throw new Error(err.message || "Erreur de connexion");
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      await signUpAction({ data: { email, password, fullName } });
    } catch (err: any) {
      throw new Error(err.message || "Erreur lors de l'inscription");
    }
  };

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem("pos_user");
  };

  const roles = user ? [user.role as AppRole] : [];

  const value: AuthState = {
    user,
    roles,
    loading,
    isAuthenticated: !!user,
    isAdmin: roles.includes("admin"),
    isStaff: roles.includes("admin") || roles.includes("cashier"),
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
