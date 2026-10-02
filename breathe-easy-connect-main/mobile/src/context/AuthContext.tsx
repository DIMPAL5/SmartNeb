import React, { createContext, useContext, useState, useEffect } from "react";
import { storage } from "../utils/storage";
import { apiClient } from "../api/client";

export type AppRole = "patient" | "doctor" | "caregiver" | "admin" | "super_admin";

export interface UserContext {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  patientId: string | null;
  doctorId: string | null;
  caregiverId: string | null;
}

interface AuthContextType {
  user: UserContext | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserContext | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const token = await storage.getItem("accessToken");
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      const res = await apiClient.get("/auth/me");
      if (res.data?.user) {
        setUser(res.data.user);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await apiClient.post("/auth/login", { email, password: pass });
      if (res.data.accessToken) {
        await storage.setItem("accessToken", res.data.accessToken);
        await storage.setItem("refreshToken", res.data.refreshToken);
        setUser(res.data.user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await storage.removeItem("accessToken");
    await storage.removeItem("refreshToken");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
