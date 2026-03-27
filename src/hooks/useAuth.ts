import { useState, useCallback } from "react";
import { Auth, Users } from "@/lib/storage";
import type { User } from "@/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => Auth.getUser());

  const login = useCallback((username: string, password: string): boolean => {
    const result = Auth.login(username, password);
    if (result) {
      setUser(result);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    Auth.logout();
    setUser(null);
  }, []);

  const updateProfile = useCallback((updates: Partial<Pick<User, "name" | "email" | "password">>) => {
    if (!user) return false;
    const updated: User = { ...user, ...updates };
    Users.upsert(updated);
    Auth.setUser(updated);
    setUser(updated);
    return true;
  }, [user]);

  const hasRole = useCallback((roles: string[]) => {
    return user ? roles.includes(user.role) : false;
  }, [user]);

  const canAccess = useCallback((module: string): boolean => {
    if (!user) return false;
    const permissions: Record<string, string[]> = {
      dashboard: ["admin", "manager", "storekeeper", "kitchen", "cashier"],
      recipes: ["admin", "manager", "kitchen"],
      inventory: ["admin", "manager", "storekeeper"],
      stockMovements: ["admin", "manager", "storekeeper"],
      sales: ["admin", "manager", "cashier"],
      reports: ["admin", "manager"],
      settings: ["admin"],
      consumption: ["admin", "manager", "kitchen", "storekeeper"],
    };
    return permissions[module]?.includes(user.role) ?? false;
  }, [user]);

  return { user, isAuthenticated: !!user, login, logout, updateProfile, hasRole, canAccess };
}
