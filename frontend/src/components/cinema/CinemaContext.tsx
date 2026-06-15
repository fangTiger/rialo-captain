import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  advanceCinemaState,
  CINEMA_TICK_MS,
  createInitialCinemaState,
  degradeDataLinkState,
  interruptCinemaState,
  markDemoOfflineState,
  markKpiTickState,
  pauseHiddenCinemaState,
  resumeCinemaState,
  recoverDataLinkState,
  routeRealProtagonistState,
  type CameraTarget,
  type CinemaMode,
  type CinemaPhase,
  type CinemaProtagonist,
  type CinemaState,
} from "./cinemaMachine";
import type { RealProtagonistEvent } from "./protagonist";

export type {
  CameraTarget,
  CinemaMode,
  CinemaPhase,
  CinemaProtagonist,
  CinemaState,
};

export interface CinemaContextValue extends CinemaState {
  interrupt: () => void;
  markDemoOffline: (protagonist: CinemaProtagonist) => void;
  markKpiTick: () => void;
  pauseHidden: () => void;
  recoverDataLink: () => void;
  resumeCinema: () => void;
  routeRealProtagonist: (event: RealProtagonistEvent) => void;
  degradeDataLink: () => void;
}

const CinemaContext = createContext<CinemaContextValue | null>(null);

interface CinemaProviderProps {
  children: ReactNode;
  initialProtagonist?: CinemaProtagonist | null;
  initialMode?: CinemaMode;
}

export function CinemaProvider({
  children,
  initialProtagonist = null,
  initialMode = "cinema",
}: CinemaProviderProps) {
  const [state, setState] = useState<CinemaState>(() =>
    createInitialCinemaState(Date.now(), initialProtagonist, initialMode),
  );

  const degradeDataLink = useCallback(
    () => setState((current) => degradeDataLinkState(current)),
    [],
  );
  const interrupt = useCallback(
    () => setState((current) => interruptCinemaState(current, Date.now())),
    [],
  );
  const markDemoOffline = useCallback(
    (protagonist: CinemaProtagonist) =>
      setState((current) => markDemoOfflineState(current, protagonist)),
    [],
  );
  const markKpiTick = useCallback(
    () => setState((current) => markKpiTickState(current)),
    [],
  );
  const pauseHidden = useCallback(
    () => setState((current) => pauseHiddenCinemaState(current)),
    [],
  );
  const recoverDataLink = useCallback(
    () => setState((current) => recoverDataLinkState(current, Date.now())),
    [],
  );
  const resumeCinema = useCallback(
    () => setState((current) => resumeCinemaState(current, Date.now())),
    [],
  );
  const routeRealProtagonist = useCallback(
    (event: RealProtagonistEvent) =>
      setState((current) =>
        routeRealProtagonistState(current, event, Date.now()),
      ),
    [],
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setState((current) => advanceCinemaState(current, Date.now()));
    }, CINEMA_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const value = useMemo<CinemaContextValue>(
    () => ({
      ...state,
      degradeDataLink,
      interrupt,
      markDemoOffline,
      markKpiTick,
      pauseHidden,
      recoverDataLink,
      resumeCinema,
      routeRealProtagonist,
    }),
    [
      degradeDataLink,
      interrupt,
      markDemoOffline,
      markKpiTick,
      pauseHidden,
      recoverDataLink,
      resumeCinema,
      routeRealProtagonist,
      state,
    ],
  );

  return (
    <CinemaContext.Provider value={value}>{children}</CinemaContext.Provider>
  );
}

export function useCinema() {
  const value = useContext(CinemaContext);
  if (!value) {
    throw new Error("useCinema must be used inside CinemaProvider");
  }
  return value;
}

export function useOptionalCinema() {
  return useContext(CinemaContext);
}
