export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeApiPath(path: string) {
  if (path.startsWith("/api/")) return path.slice(4);
  if (path === "/api") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function makeApiUrl(path: string) {
  const baseUrl = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL ?? "");
  if (baseUrl) {
    return `${baseUrl}${normalizeApiPath(path)}`;
  }
  return path.startsWith("/api") ? path : `/api${normalizeApiPath(path)}`;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = makeApiUrl(path);
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} on ${url}`);
  }

  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}
