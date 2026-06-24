import useSWR from "swr";
import { apiFetch } from "../api/client";

export type EvidenceSubject =
  | { kind: "claim"; id: string }
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

  return {
    timeline: data ?? null,
    events: data?.events ?? [],
    error,
    isLoading: path ? isLoading : false,
    refresh: mutate,
  };
}
