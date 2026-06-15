import type { ReactNode } from "react";
import { useCinema, type CameraTarget } from "./CinemaContext";

interface CameraDirectorProps {
  children: (cameraTarget: CameraTarget | null) => ReactNode;
}

export function CameraDirector({ children }: CameraDirectorProps) {
  const { cameraTarget } = useCinema();
  return <>{children(cameraTarget)}</>;
}
