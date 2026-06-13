import useSWR from "swr";
import { apiFetch, ApiError } from "../api/client";
import type { CurrentUser } from "../types";

const fetcher = async (path: string): Promise<CurrentUser | null> => {
  try {
    return await apiFetch<CurrentUser>(path);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
};

export function useMe() {
  const { data, error, isLoading, mutate } = useSWR<CurrentUser | null>(
    "/me",
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  return { user: data ?? null, error, isLoading, refresh: mutate };
}
