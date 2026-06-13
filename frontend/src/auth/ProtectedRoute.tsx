import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useMe } from "../hooks/useMe";

interface Props {
  children: ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const { user, isLoading } = useMe();

  if (isLoading) {
    return (
      <div
        style={{
          padding: 24,
          color: "var(--text-secondary)",
          fontFamily: "var(--font-mono)",
        }}
      >
        checking session...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
