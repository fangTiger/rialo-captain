import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
} from "../../api/client";
import {
  CopilotStreamProtocolError,
  askCopilot,
  askCopilotStream,
  type CopilotAnswer,
  type CopilotAskInput,
  type CopilotSource,
  type CopilotSubjectType,
} from "../../api/copilot";

type CopilotConnectionStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "error";

interface OpenCopilotOptions {
  subjectType?: CopilotSubjectType;
  subjectId?: string;
  question?: string;
  reset?: boolean;
}

interface AskCopilotOptions {
  openPanel?: boolean;
}

interface CopilotContextValue {
  isOpen: boolean;
  isLoading: boolean;
  connectionStatus: CopilotConnectionStatus;
  question: string;
  activeSubjectType: CopilotSubjectType;
  activeSubjectId?: string;
  response: CopilotAnswer | null;
  errorMessage: string | null;
  promptSuggestions: string[];
  openPanel: (options?: OpenCopilotOptions) => void;
  stop: () => void;
  closePanel: () => void;
  setQuestion: (value: string) => void;
  submitQuestion: () => Promise<void>;
  ask: (input: CopilotAskInput, options?: AskCopilotOptions) => Promise<void>;
}

const CopilotContext = createContext<CopilotContextValue | null>(null);

function defaultPrompts(subjectType: CopilotSubjectType) {
  switch (subjectType) {
    case "flight":
      return [
        "Why is this flight risky?",
        "Summarize the delay evidence",
        "What should I verify first?",
      ];
    case "policy":
      return [
        "Explain this policy",
        "What payout conditions matter most here?",
        "Which evidence supports it?",
      ];
    case "claim":
      return [
        "Why did this claim pay?",
        "Which evidence justified this settlement?",
        "What should I review next?",
      ];
    case "evidence":
      return [
        "Explain this evidence chain",
        "Which event should I verify first?",
        "What does this change?",
      ];
    case "overview":
    default:
      return [
        "What needs attention right now?",
        "Which flights look payout-prone today?",
        "Where is settlement risk building?",
        "Which live flights are still uninsured?",
        "What should I verify first in evidence?",
      ];
  }
}

function capPrompts(prompts: string[]) {
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const prompt of prompts) {
    const normalized = prompt.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
    if (deduped.length === 5) break;
  }
  return deduped;
}

function toPartialResponse({
  answer,
  sources,
  suggested_prompts,
  model,
  status = "ok",
}: {
  answer: string;
  sources: CopilotSource[];
  suggested_prompts: string[];
  model: string;
  status?: "ok" | "unavailable";
}): CopilotAnswer {
  return {
    status,
    answer,
    sources,
    suggested_prompts: capPrompts(suggested_prompts),
    confidence: 0,
    model,
  };
}

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<CopilotConnectionStatus>("idle");
  const [question, setQuestion] = useState("");
  const [activeSubjectType, setActiveSubjectType] =
    useState<CopilotSubjectType>("overview");
  const [activeSubjectId, setActiveSubjectId] = useState<string | undefined>();
  const [response, setResponse] = useState<CopilotAnswer | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const ask = useCallback(
    async (input: CopilotAskInput, options?: AskCopilotOptions) => {
      const trimmedQuestion = input.question.trim();
      if (!trimmedQuestion) {
        setErrorMessage("Question is required.");
        if (options?.openPanel ?? true) {
          setIsOpen(true);
        }
        return;
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestSequence = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestSequence;
      let hasStreamedAnswer = false;

      if (options?.openPanel ?? true) {
        setIsOpen(true);
      }
      setConnectionStatus("connecting");
      setQuestion(trimmedQuestion);
      setActiveSubjectType(input.subjectType);
      setActiveSubjectId(input.subjectId);
      setErrorMessage(null);
      setResponse(null);

      const safeSetResponse = (
        updater: CopilotAnswer | null | ((previous: CopilotAnswer | null) => CopilotAnswer | null),
      ) => {
        if (requestSequenceRef.current !== requestSequence) {
          return;
        }
        setResponse((previous) =>
          typeof updater === "function" ? updater(previous) : updater,
        );
      };

      const safeSetError = (message: string | null) => {
        if (requestSequenceRef.current === requestSequence) {
          setErrorMessage(message);
        }
      };

      const safeSetStatus = (status: CopilotConnectionStatus) => {
        if (requestSequenceRef.current === requestSequence) {
          setConnectionStatus(status);
        }
      };

      try {
        await askCopilotStream(
          {
            ...input,
            question: trimmedQuestion,
          },
          {
            onContext(data) {
              safeSetStatus("streaming");
              safeSetResponse(
                toPartialResponse({
                  answer: "",
                  sources: data.sources,
                  suggested_prompts: [],
                  model: data.model,
                }),
              );
            },
            onDelta(data) {
              hasStreamedAnswer = true;
              safeSetStatus("streaming");
              safeSetResponse((previous) =>
                toPartialResponse({
                  answer: `${previous?.answer ?? ""}${data.delta}`,
                  sources: previous?.sources ?? [],
                  suggested_prompts: previous?.suggested_prompts ?? [],
                  model: previous?.model ?? "deepseek-v4-pro",
                  status: previous?.status ?? "ok",
                }),
              );
            },
            onSuggestions(data) {
              safeSetResponse((previous) =>
                previous
                  ? {
                      ...previous,
                      suggested_prompts: capPrompts(data.suggested_prompts),
                    }
                  : previous,
              );
            },
            onDone(data) {
              safeSetStatus("idle");
              safeSetResponse({
                ...data,
                suggested_prompts: capPrompts(data.suggested_prompts),
              });
            },
            onError(data) {
              safeSetStatus("error");
              safeSetError(data.message);
              safeSetResponse((previous) =>
                previous
                  ? {
                      ...previous,
                      status: "unavailable",
                    }
                  : previous,
              );
            },
          },
          controller.signal,
        );
      } catch (error) {
        if (requestSequenceRef.current !== requestSequence) {
          return;
        }
        if (controller.signal.aborted) {
          return;
        }
        if (error instanceof CopilotStreamProtocolError && hasStreamedAnswer) {
          setConnectionStatus("error");
          setErrorMessage("Rialo Copilot stream ended unexpectedly.");
          return;
        }
        try {
          const fallback = await askCopilot({
            ...input,
            question: trimmedQuestion,
          });
          if (requestSequenceRef.current !== requestSequence) {
            return;
          }
          setConnectionStatus("idle");
          setResponse({
            ...fallback,
            suggested_prompts: capPrompts(fallback.suggested_prompts),
          });
          setErrorMessage(null);
        } catch (fallbackError) {
          if (requestSequenceRef.current !== requestSequence) {
            return;
          }
          setConnectionStatus("error");
          if (fallbackError instanceof ApiError && fallbackError.status === 401) {
            setErrorMessage("Session expired. Sign in again to use Rialo Copilot.");
          } else if (error instanceof CopilotStreamProtocolError) {
            setErrorMessage("Rialo Copilot stream ended unexpectedly.");
          } else {
            setErrorMessage("Rialo Copilot is temporarily unavailable.");
          }
        }
      } finally {
        if (requestSequenceRef.current === requestSequence) {
          abortControllerRef.current = null;
        }
      }
    },
    [],
  );

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    requestSequenceRef.current += 1;
    setConnectionStatus("idle");
    setErrorMessage(null);
  }, []);

  const openPanel = useCallback((options?: OpenCopilotOptions) => {
    setIsOpen(true);
    if (options?.reset) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      requestSequenceRef.current += 1;
      setConnectionStatus("idle");
      setResponse(null);
      setErrorMessage(null);
      setActiveSubjectType(options.subjectType ?? "overview");
      setActiveSubjectId(options.subjectId);
      setQuestion(options.question ?? "");
      return;
    }

    setErrorMessage(null);
    if (options?.subjectType) {
      setActiveSubjectType(options.subjectType);
    }
    if (options?.subjectId !== undefined) {
      setActiveSubjectId(options.subjectId);
    }
    if (options?.question !== undefined) {
      setQuestion(options.question);
    }
  }, []);

  const closePanel = useCallback(() => {
    stop();
    setIsOpen(false);
  }, [stop]);

  const submitQuestion = useCallback(async () => {
    await ask(
      {
        question,
        subjectType: activeSubjectType,
        subjectId: activeSubjectId,
      },
      { openPanel: true },
    );
  }, [activeSubjectId, activeSubjectType, ask, question]);

  const promptSuggestions = useMemo(() => {
    if (response?.suggested_prompts.length) {
      return capPrompts(response.suggested_prompts);
    }
    return capPrompts(defaultPrompts(activeSubjectType));
  }, [activeSubjectType, response?.suggested_prompts]);

  const isLoading =
    connectionStatus === "connecting" || connectionStatus === "streaming";

  const value = useMemo<CopilotContextValue>(
    () => ({
      isOpen,
      isLoading,
      connectionStatus,
      question,
      activeSubjectType,
      activeSubjectId,
      response,
      errorMessage,
      promptSuggestions,
      openPanel,
      stop,
      closePanel,
      setQuestion,
      submitQuestion,
      ask,
    }),
    [
      activeSubjectId,
      activeSubjectType,
      ask,
      closePanel,
      connectionStatus,
      errorMessage,
      isLoading,
      isOpen,
      openPanel,
      stop,
      promptSuggestions,
      question,
      response,
      submitQuestion,
    ],
  );

  return (
    <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>
  );
}

export function useCopilot() {
  const context = useContext(CopilotContext);

  if (!context) {
    throw new Error("useCopilot must be used within CopilotProvider");
  }

  return context;
}
