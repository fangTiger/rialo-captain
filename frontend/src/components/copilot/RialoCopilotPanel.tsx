import { useEffect, useId, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CopilotPromptChip } from "./CopilotPromptChip";
import { useCopilot } from "./CopilotProvider";
import { filterEvidenceByAnswer, hasSuccessfulFinalAnswer } from "./evidence";
import type { CopilotSource } from "../../api/copilot";

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function scopeLabel(subjectType: string) {
  switch (subjectType) {
    case "flight":
      return "Flight scope";
    case "policy":
      return "Policy scope";
    case "claim":
      return "Claim scope";
    case "evidence":
      return "Evidence scope";
    case "overview":
    default:
      return "Overview scope";
  }
}

export function RialoCopilotPanel() {
  const titleId = useId();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const questionRef = useRef<HTMLTextAreaElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const {
    isOpen,
    isLoading,
    connectionStatus,
    question,
    activeSubjectType,
    activeSubjectId,
    response,
    errorMessage,
    promptSuggestions,
    closePanel,
    setQuestion,
    submitQuestion,
  } = useCopilot();
  const canShowEvidence = hasSuccessfulFinalAnswer(response, {
    isLoading,
    errorMessage,
  });
  const visibleEvidence = useMemo(() => {
    if (!canShowEvidence || !response) {
      return [];
    }
    return filterEvidenceByAnswer(response.answer, response.sources);
  }, [canShowEvidence, response]);
  const hasAnswerText = Boolean(response?.answer.trim());
  const showAnswerStream = isLoading || hasAnswerText || Boolean(errorMessage);
  const answerHeading = isLoading
    ? "Live answer"
    : response?.status === "unavailable" || errorMessage
      ? "AI unavailable"
      : response
        ? "Answer"
        : "Live answer";
  const liveStatus =
    connectionStatus === "connecting"
      ? "connecting"
      : connectionStatus === "streaming"
        ? "streaming"
        : null;
  const announcedStatus = errorMessage
    ? "error"
    : liveStatus ?? (response ? "Answer ready" : null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const initialFocusTarget = closeButtonRef.current ?? questionRef.current;
    initialFocusTarget?.focus();

    return () => {
      const previousFocus = previousFocusRef.current;
      previousFocusRef.current = null;

      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-hidden") !== "true",
      );
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (!activeElement || !dialog.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? dialog : focusableElements[0] ?? dialog).focus();
        return;
      }

      const firstFocusable = focusableElements[0] ?? dialog;
      const lastFocusable =
        focusableElements.length > 0
          ? focusableElements[focusableElements.length - 1]
          : dialog;

      if (event.shiftKey) {
        if (activeElement === dialog) {
          event.preventDefault();
          lastFocusable.focus();
          return;
        }

        if (activeElement === firstFocusable) {
          event.preventDefault();
          dialog.focus();
        }
        return;
      }

      if (activeElement === dialog || activeElement === lastFocusable) {
        event.preventDefault();
        if (activeElement === dialog) {
          firstFocusable.focus();
        } else {
          dialog.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closePanel, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div
        aria-hidden="true"
        onClick={closePanel}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2, 4, 8, 0.68)",
          backdropFilter: "blur(2px)",
          zIndex: 89,
        }}
      />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(100vw, 35rem)",
          background: "var(--surface-1)",
          borderLeft: "1px solid var(--border-emphasis)",
          boxShadow: "var(--elev-2)",
          zIndex: 90,
          display: "grid",
          gridTemplateRows: "auto auto auto minmax(0, 1fr)",
        }}
      >
        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Close Ask Rialo"
          onClick={closePanel}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 36,
            height: 36,
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sharp)",
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
            cursor: "pointer",
          }}
        >
          X
        </button>
        <header
          style={{
            padding: "22px 64px 18px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "grid",
            gap: 8,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: 0.18,
              textTransform: "uppercase",
              color: "var(--accent-radar)",
            }}
          >
            Ask Rialo
          </div>
          <h2
            id={titleId}
            style={{
              margin: 0,
              fontSize: 26,
              lineHeight: 1.1,
              color: "var(--text-primary)",
            }}
          >
            Copilot reads the current tower before it answers.
          </h2>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-secondary)",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <span>{scopeLabel(activeSubjectType)}</span>
            {activeSubjectId ? <span>ID: {activeSubjectId}</span> : null}
          </div>
        </header>

        <section
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          AI answers use current Rialo data and evidence. Final settlement still
          follows deterministic product rules.
        </section>

        <form
          aria-label="Ask Rialo form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitQuestion();
          }}
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "grid",
            gap: 10,
          }}
        >
          <label
            htmlFor="copilot-question"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              textTransform: "uppercase",
              color: "var(--text-secondary)",
            }}
          >
            Question
          </label>
          <textarea
            ref={questionRef}
            id="copilot-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about risk, payout logic, or evidence."
            rows={3}
            style={{
              width: "100%",
              resize: "vertical",
              minHeight: 96,
              padding: "12px 14px",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-soft)",
              background: "var(--surface-2)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--text-tertiary)",
              }}
            >
              Copilot can explain risk, policy logic, claims, and evidence.
            </div>
            <button
              type="submit"
              aria-label="Submit question"
              disabled={isLoading}
              style={{
                minWidth: 132,
                padding: "10px 14px",
                border: "1px solid var(--border-emphasis)",
                borderRadius: "var(--radius-sharp)",
                background: isLoading ? "var(--surface-2)" : "var(--accent-radar)",
                color: isLoading ? "var(--text-secondary)" : "#05120c",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                textTransform: "uppercase",
                cursor: isLoading ? "wait" : "pointer",
              }}
            >
              {isLoading ? "Streaming..." : "Submit"}
            </button>
          </div>
        </form>

        <div
          style={{
            overflowY: "auto",
            minHeight: 0,
            padding: "18px 20px 24px",
            display: "grid",
            gap: 18,
          }}
        >
          <section style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                textTransform: "uppercase",
                color: "var(--text-secondary)",
              }}
            >
              Followups
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {promptSuggestions.map((prompt) => (
                <CopilotPromptChip
                  key={prompt}
                  label={prompt}
                  subjectType={activeSubjectType}
                  subjectId={activeSubjectId}
                  tone={response ? "muted" : "default"}
                />
              ))}
            </div>
          </section>

          {showAnswerStream ? (
            <section
              style={{
                display: "grid",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      textTransform: "uppercase",
                      color:
                        answerHeading === "AI unavailable"
                          ? "var(--warn-amber)"
                          : "var(--accent-radar)",
                    }}
                  >
                    {answerHeading}
                  </div>
                  {announcedStatus ? (
                    <div
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        textTransform: "uppercase",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <span>{announcedStatus}</span>
                    </div>
                  ) : null}
                </div>
                {hasAnswerText || isLoading ? (
                  <article
                    aria-label="Answer stream"
                    style={{
                      fontSize: 15,
                      lineHeight: 1.7,
                      color: "var(--text-primary)",
                      overflowWrap: "anywhere",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {response?.answer ?? ""}
                    {isLoading ? (
                      <span
                        aria-hidden="true"
                        style={{
                          marginLeft: 4,
                          color: "var(--accent-radar)",
                          fontFamily: "var(--font-mono)",
                          animation:
                            "rialo-copilot-cursor-blink 1s steps(1, end) infinite",
                        }}
                      >
                        ▌
                      </span>
                    ) : null}
                  </article>
                ) : null}
                {!isLoading && response ? (
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <span>status: {response.status}</span>
                    <span>model: {response.model}</span>
                    <span>confidence: {Math.round(response.confidence * 100)}%</span>
                  </div>
                ) : null}
                {errorMessage ? (
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--warn-amber)",
                      lineHeight: 1.6,
                    }}
                  >
                    {errorMessage}
                  </div>
                ) : null}
              </div>

              {visibleEvidence.length ? (
                <section
                  style={{
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      textTransform: "uppercase",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Evidence used
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    {visibleEvidence.map((source) => (
                      <div
                        key={`${source.type}:${source.id}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 10px",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "999px",
                          background: "rgba(20, 24, 31, 0.72)",
                          maxWidth: "100%",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            textTransform: "uppercase",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          {source.type}
                        </div>
                        {sourceHrefToRoute(source) ? (
                          <button
                            type="button"
                            onClick={() => navigate(sourceHrefToRoute(source)!)}
                            style={{
                              padding: 0,
                              border: "none",
                              background: "transparent",
                              color: "var(--text-primary)",
                              textDecoration: "none",
                              overflowWrap: "anywhere",
                              textAlign: "left",
                              cursor: "pointer",
                            }}
                          >
                            {source.label}
                          </button>
                        ) : (
                          <div
                            style={{
                              color: "var(--text-primary)",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {source.label}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </section>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function sourceHrefToRoute(source: CopilotSource) {
  if (source.type === "flight") {
    return `/flight/${source.id}`;
  }

  if (source.type === "policy") {
    return "/policies";
  }

  if (source.type === "claim") {
    return "/claims";
  }

  if (source.type === "evidence") {
    if (source.href?.includes("/claims/")) {
      return "/claims";
    }
    if (source.href?.includes("/policies/")) {
      return "/policies";
    }
  }

  return null;
}
