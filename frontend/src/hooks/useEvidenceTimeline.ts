import useSWR from "swr";
import { ApiError, apiFetch } from "../api/client";

export type EvidenceSubject =
  | { kind: "claim"; id: string; fallbackTimeline?: EvidenceTimeline }
  | { kind: "policy"; id: string }
  | null;

export interface EvidenceEvent {
  id: string;
  type: string;
  title: string;
  source: string;
  created_at: number;
  payload: Record<string, unknown>;
}

export interface EvidenceTimeline {
  subject: {
    policy_id: string;
    flight_id: string;
    claim_id: string | null;
  };
  events: EvidenceEvent[];
}

const fetcher = (path: string) => apiFetch<EvidenceTimeline>(path);

function timelinePath(subject: EvidenceSubject) {
  if (!subject) {
    return null;
  }

  return subject.kind === "claim"
    ? `/claims/${subject.id}/timeline`
    : `/policies/${subject.id}/timeline`;
}

export function useEvidenceTimeline(subject: EvidenceSubject) {
  const path = timelinePath(subject);
  const { data, error, isLoading, mutate } = useSWR<EvidenceTimeline>(
    path,
    fetcher,
  );
  const fallbackTimeline =
    subject?.kind === "claim" ? subject.fallbackTimeline : undefined;
  const useFallback =
    !data &&
    Boolean(fallbackTimeline) &&
    error instanceof ApiError &&
    error.status === 404;
  const timeline = data ?? (useFallback ? fallbackTimeline ?? null : null);

  return {
    timeline,
    events: timeline?.events ?? [],
    error: useFallback ? null : error,
    isLoading: path ? isLoading : false,
    refresh: mutate,
  };
}
