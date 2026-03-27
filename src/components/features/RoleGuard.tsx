import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types";

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  redirect?: string;
}

export default function RoleGuard({ allowedRoles, children, redirect = "/dashboard" }: RoleGuardProps) {
  const { user } = useAuth();
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to={redirect} replace />;
  }
  return <>{children}</>;
}
