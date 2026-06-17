import { useEffect } from "react";
import { useCinema } from "./CinemaContext";
import { useEventStore } from "../../store/eventStore";
import { resolvePublicDeployConfig } from "../../config/deployment";

export function CinemaController() {
  const {
    degradeDataLink,
    interrupt,
    pauseHidden,
    recoverDataLink,
    resumeCinema,
  } = useCinema();
  const wsState = useEventStore((state) => state.wsState);
  const deployConfig = resolvePublicDeployConfig();
  const allowOfflineDemo =
    deployConfig.devLoginEnabled && deployConfig.wsBaseUrl === "";

  useEffect(() => {
    if (wsState === "retrying" || wsState === "closed") {
      if (!allowOfflineDemo) {
        degradeDataLink();
      }
      return;
    }

    if (wsState === "open") {
      recoverDataLink();
    }
  }, [allowOfflineDemo, degradeDataLink, recoverDataLink, wsState]);

  useEffect(() => {
    const onInput = () => interrupt();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        resumeCinema();
        return;
      }
      interrupt();
    };
    const onMouseMove = (event: MouseEvent) => {
      if (event.buttons > 0) interrupt();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.buttons > 0) interrupt();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        pauseHidden();
        return;
      }
      resumeCinema();
    };

    window.addEventListener("click", onInput);
    window.addEventListener("wheel", onInput);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("pointermove", onPointerMove);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("click", onInput);
      window.removeEventListener("wheel", onInput);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [interrupt, pauseHidden, resumeCinema]);

  return null;
}
