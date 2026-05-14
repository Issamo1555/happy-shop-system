import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loginAction, signUpAction, validateSessionAction, resetPasswordAction, updateUserProfileAction, uploadAvatarAction } from "./actions";

export type AppRole = "admin" | "cashier";

interface AuthState {
  user: any | null;
  roles: AppRole[];
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, inviteCode: string) => Promise<void>;
  resetPassword: (email: string, inviteCode: string, newPassword: string) => Promise<void>;
  updateProfile: (email: string, fullName: string, avatarUrl: string) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validate session server-side on app load
    const validateSession = async () => {
      try {
        const savedUser = localStorage.getItem("pos_user");
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          // Verify the user still exists and get REAL role from server
          const serverUser = await validateSessionAction({ data: { userId: parsed.id } });
          if (serverUser) {
            setUser(serverUser);
            localStorage.setItem("pos_user", JSON.stringify(serverUser));
          } else {
            // User no longer exists in DB - clear session
            localStorage.removeItem("pos_user");
            setUser(null);
          }
        }
      } catch {
        localStorage.removeItem("pos_user");
        setUser(null);
      }
      setLoading(false);
    };
    validateSession();
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

  const signUp = async (email: string, password: string, fullName: string, inviteCode: string) => {
    try {
      await signUpAction({ data: { email, password, fullName, inviteCode } });
    } catch (err: any) {
      throw new Error(err.message || "Erreur lors de l'inscription");
    }
  };

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem("pos_user");
  };

  const resetPassword = async (email: string, inviteCode: string, newPassword: string) => {
    try {
      await resetPasswordAction({ data: { email, inviteCode, newPassword } });
    } catch (err: any) {
      throw new Error(err.message || "Erreur lors de la réinitialisation");
    }
  };

  const updateProfile = async (email: string, fullName: string, avatarUrl: string) => {
    if (!user) return;
    try {
      const updatedUser = await updateUserProfileAction({ data: { userId: user.id, email, full_name: fullName, avatar_url: avatarUrl } });
      setUser(updatedUser);
      localStorage.setItem("pos_user", JSON.stringify(updatedUser));
    } catch (err: any) {
      throw new Error(err.message || "Erreur lors de la mise à jour du profil");
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const base64 = await base64Promise;
      
      const updatedUser = await uploadAvatarAction({ 
        data: { 
          userId: user.id, 
          base64, 
          filename: file.name 
        } 
      });
      setUser(updatedUser);
      localStorage.setItem("pos_user", JSON.stringify(updatedUser));
    } catch (err: any) {
      throw new Error(err.message || "Erreur lors du téléchargement de l'image");
    }
  };

  // Role is now always from server validation, not localStorage
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
    resetPassword,
    updateProfile,
    uploadAvatar,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
