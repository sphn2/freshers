"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getApiBaseUrl } from "@/lib/api-url";

export type Role = "SUPER_ADMIN" | "ADMIN" | "EVENT_MANAGER" | "OFFLINE_COLLECTOR" | "GATE_STAFF" | "FOOD_STAFF" | "STUDENT";

interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
}

interface AuthContextType {
  user: AuthUser | null;
  role: Role;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Role>;
  logout: () => Promise<void>;
  hasRole: (allowedRoles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function selectRole(roles: string[]): Role {
  const supported: Role[] = ["SUPER_ADMIN", "ADMIN", "EVENT_MANAGER", "OFFLINE_COLLECTOR", "GATE_STAFF", "FOOD_STAFF", "STUDENT"];
  return supported.find((candidate) => roles.includes(candidate)) || "STUDENT";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<Role>("STUDENT");
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const hydratedToken = useRef<string | null>(null);
  const hydratedRole = useRef<Role | null>(null);
  const router = useRouter();

  const hydrate = async (accessToken: string, fallbackUser: { id: string; email?: string | null }) => {
    if (hydratedToken.current === accessToken && hydratedRole.current) {
      return hydratedRole.current;
    }
    const response = await fetch(`${getApiBaseUrl()}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error("Your account could not be authorized for this platform.");
    const data = await response.json();
    const assignedRole = selectRole(data.roles || []);
    hydratedToken.current = accessToken;
    hydratedRole.current = assignedRole;
    setToken(accessToken);
    setRole(assignedRole);
    setUser({
      id: data.user?.id || fallbackUser.id,
      email: data.user?.email || fallbackUser.email || "",
      full_name: data.user?.full_name || fallbackUser.email?.split("@")[0] || "Sphoorthy User",
      role: assignedRole,
    });
    return assignedRole;
  };

  useEffect(() => {
    const client = supabase;
    if (!client) {
      return;
    }
    const restore = async () => {
      const { data } = await client.auth.getSession();
      if (data.session?.access_token && data.session.user) {
        try {
          await hydrate(data.session.access_token, data.session.user);
        } catch {
          await client.auth.signOut();
        }
      }
      setLoading(false);
    };
    void restore();
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (!session?.access_token || !session.user) {
        hydratedToken.current = null;
        hydratedRole.current = null;
        setToken(null);
        setRole("STUDENT");
        setUser(null);
        return;
      }
      void hydrate(session.access_token, session.user).catch(() => undefined);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase client configuration is missing.");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) throw new Error(error?.message || "Unable to sign in.");
    return hydrate(data.session.access_token, data.user);
  };

  const logout = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    setToken(null);
    setRole("STUDENT");
    setUser(null);
    hydratedToken.current = null;
    hydratedRole.current = null;
    router.push("/");
  };

  const checkRole = (allowedRoles: Role[]) => {
    if (role === "SUPER_ADMIN") return true;
    return allowedRoles.includes(role);
  };

  return <AuthContext.Provider value={{ user, role, token, loading, login, logout, hasRole: checkRole }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}

export function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: Role[] }) {
  const { user, role, loading, hasRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
  }, [loading, pathname, router, user]);

  if (loading) return <div className="p-8 text-center text-slate-500 font-medium">Verifying your session…</div>;
  if (!user) return null;
  if (!hasRole(allowedRoles)) {
    return <div className="max-w-md mx-auto my-12 rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm"><h3 className="text-xl font-black text-rose-800">Access denied</h3><p className="mt-2 text-sm text-rose-700">Your {role.replaceAll("_", " ")} account cannot access this area.</p></div>;
  }
  return <>{children}</>;
}
