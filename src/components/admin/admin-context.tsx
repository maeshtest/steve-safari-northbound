import { createContext, useContext } from "react";
import type { AppRole } from "@/lib/constants";

export type AdminMe = { userId: string; email: string; fullName: string | null; roles: AppRole[]; mustChangePassword: boolean; active: boolean };

export const AdminContext = createContext<AdminMe | null>(null);

export function useAdmin() {
  const me = useContext(AdminContext);
  if (!me) throw new Error("useAdmin must be used inside the admin layout");
  const isSuper = me.roles.includes("super_admin");
  const isAdmin = isSuper || me.roles.includes("admin");
  return { ...me, isSuper, isAdmin };
}
