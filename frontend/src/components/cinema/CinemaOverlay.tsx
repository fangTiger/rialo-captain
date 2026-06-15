import type { ReactNode } from "react";

interface CinemaOverlayProps {
  children?: ReactNode;
}

export function CinemaOverlay({ children }: CinemaOverlayProps) {
  return (
    <div
      data-testid="cinema-overlay"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      {children}
    </div>
  );
}
