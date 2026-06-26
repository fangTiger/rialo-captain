import { resolvePublicDeployConfig } from "../config/deployment";
import { ApiError, apiFetch } from "./client";

export type CopilotSubjectType =
  | "overview"
  | "flight"
  | "policy"
  | "claim"
  | "evidence";

export interface CopilotAskInput {
  question: string;
  subjectType: CopilotSubjectType;
  subjectId?: string;
}

export interface CopilotSource {
  type: string;
  id: string;
  label: string;
  href?: string;
}

export interface CopilotAnswer {
  status: "ok" | "unavailable";
  answer: string;
  sources: CopilotSource[];
  suggested_prompts: string[];
  confidence: number;
  model: string;
}

export interface CopilotStreamContextEvent {
  subject_type: CopilotSubjectType;
  subject_id?: string;
  sources: CopilotSource[];
  model: string;
  summary: Record<string, unknown>;
}

export interface CopilotStreamDeltaEvent {
  delta: string;
}

export interface CopilotStreamSuggestionsEvent {
  suggested_prompts: string[];
}

export interface CopilotStreamErrorEvent {
  code: string;
  message: string;
}

interface CopilotStreamEventMap {
  context: CopilotStreamContextEvent;
  delta: CopilotStreamDeltaEvent;
  suggestions: CopilotStreamSuggestionsEvent;
  done: CopilotAnswer;
  error: CopilotStreamErrorEvent;
}

export interface CopilotStreamHandlers {
  onContext?: (data: CopilotStreamContextEvent) => void;
  onDelta?: (data: CopilotStreamDeltaEvent) => void;
  onSuggestions?: (data: CopilotStreamSuggestionsEvent) => void;
  onDone?: (data: CopilotAnswer) => void;
  onError?: (data: CopilotStreamErrorEvent) => void;
}

export class CopilotStreamProtocolError extends Error {}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeApiPath(path: string) {
  if (path.startsWith("/api/")) return path.slice(4);
  if (path === "/api") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function makeApiUrl(path: string) {
  const baseUrl = trimTrailingSlash(resolvePublicDeployConfig().apiBaseUrl);
  if (baseUrl) {
    return `${baseUrl}${normalizeApiPath(path)}`;
  }
  return path.startsWith("/api") ? path : `/api${normalizeApiPath(path)}`;
}

function toRequestBody(input: CopilotAskInput) {
  return {
    question: input.question,
    subject_type: input.subjectType,
    ...(input.subjectId ? { subject_id: input.subjectId } : {}),
  };
}

function dispatchStreamEvent(
  event: keyof CopilotStreamEventMap,
  data: CopilotStreamEventMap[keyof CopilotStreamEventMap],
  handlers: CopilotStreamHandlers,
) {
  switch (event) {
    case "context":
      handlers.onContext?.(data as CopilotStreamContextEvent);
      break;
    case "delta":
      handlers.onDelta?.(data as CopilotStreamDeltaEvent);
      break;
    case "suggestions":
      handlers.onSuggestions?.(data as CopilotStreamSuggestionsEvent);
      break;
    case "done":
      handlers.onDone?.(data as CopilotAnswer);
      break;
    case "error":
      handlers.onError?.(data as CopilotStreamErrorEvent);
      break;
    default:
      break;
  }
}

function parseEventBlock(
  block: string,
): { event: keyof CopilotStreamEventMap; data: CopilotStreamEventMap[keyof CopilotStreamEventMap] } | null {
  let eventName: keyof CopilotStreamEventMap | null = null;
  const dataLines: string[] = [];

  for (const rawLine of block.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim() as keyof CopilotStreamEventMap;
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (!eventName) {
    return null;
  }

  return {
    event: eventName,
    data: JSON.parse(dataLines.join("\n")),
  };
}

export function askCopilot(input: CopilotAskInput) {
  return apiFetch<CopilotAnswer>("/copilot/ask", {
    method: "POST",
    body: JSON.stringify(toRequestBody(input)),
  });
}

export async function askCopilotStream(
  input: CopilotAskInput,
  handlers: CopilotStreamHandlers,
  signal?: AbortSignal,
) {
  const response = await fetch(makeApiUrl("/copilot/ask/stream"), {
    method: "POST",
    credentials: "include",
    signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(toRequestBody(input)),
  });

  if (!response.ok) {
    throw new ApiError(response.status, `${response.status} on /copilot/ask/stream`);
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const rawText = await response.text();
    try {
      const parsed = JSON.parse(rawText) as CopilotAnswer;
      handlers.onDone?.(parsed);
      return;
    } catch {
      throw new CopilotStreamProtocolError("Expected text/event-stream response.");
    }
  }

  if (!response.body) {
    throw new CopilotStreamProtocolError("Missing stream body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawTerminalEvent = false;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    buffer = buffer.replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);
      if (block) {
        const parsed = parseEventBlock(block);
        if (parsed) {
          dispatchStreamEvent(parsed.event, parsed.data, handlers);
          if (parsed.event === "done" || parsed.event === "error") {
            sawTerminalEvent = true;
          }
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
    if (done) {
      break;
    }
  }

  if (!sawTerminalEvent) {
    throw new CopilotStreamProtocolError("Stream ended without terminal event.");
  }
}
