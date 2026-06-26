import { useMemo, useState } from "react";
import { useCopilot } from "./CopilotProvider";
import { filterEvidenceByAnswer, hasSuccessfulFinalAnswer } from "./evidence";

const OVERVIEW_PROMPTS = [
  "What needs attention right now?",
  "Which flights look payout-prone today?",
  "Where is settlement risk building?",
  "Which live flights are still uninsured?",
  "What should I verify first in evidence?",
] as const;
const AI_BRIEFING_BODY_ID = "ai-briefing-body";

export function AIBriefing() {
  const {
    ask,
    activeSubjectType,
    connectionStatus,
    errorMessage,
    isLoading,
    promptSuggestions,
    response,
    stop,
  } = useCopilot();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [question, setQuestion] = useState("");

  const isOverviewActive = activeSubjectType === "overview";
  const inlineResponse = isOverviewActive ? response : null;
  const inlineError = isOverviewActive ? errorMessage : null;
  const inlineLoading = isOverviewActive && isLoading;
  const selectedPrompt = question.trim();
  const canSubmit = Boolean(selectedPrompt);
  const hasInlineAnswer = Boolean(inlineResponse?.answer);
  const canShowEvidence = hasSuccessfulFinalAnswer(inlineResponse, {
    isLoading: inlineLoading,
    errorMessage: inlineError,
  });
  const inlineAnswerHeading =
    inlineError && !inlineLoading
      ? "Recoverable error"
      : inlineLoading
        ? "ANSWER BUFFER"
        : "ANSWER";
  const visibleEvidence = useMemo(() => {
    if (!canShowEvidence || !inlineResponse) {
      return [];
    }
    return filterEvidenceByAnswer(inlineResponse.answer, inlineResponse.sources);
  }, [canShowEvidence, inlineResponse]);
  const recommendations = useMemo(() => {
    if (isOverviewActive && promptSuggestions.length) {
      return promptSuggestions.slice(0, 5);
    }
    return Array.from(OVERVIEW_PROMPTS).slice(0, 5);
  }, [isOverviewActive, promptSuggestions]);

  const submitQuestion = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    await ask(
      {
        question: trimmed,
        subjectType: "overview",
      },
      { openPanel: false },
    );
  };

  return (
    <section
      data-testid="ai-briefing"
      data-collapsed={isCollapsed ? "true" : "false"}
      style={{
        width: isCollapsed ? "fit-content" : "min(100%, 28rem)",
        maxWidth: isCollapsed ? "min(100%, 13rem)" : "min(100%, 28rem)",
        padding: isCollapsed ? "8px 10px" : "18px 18px 16px",
        border: `1px solid ${
          isCollapsed ? "var(--border-subtle)" : "var(--border-emphasis)"
        }`,
        borderRadius: isCollapsed ? 999 : "var(--radius-soft)",
        background: isCollapsed ? "rgba(11, 14, 18, 0.78)" : "rgba(11, 14, 18, 0.92)",
        boxShadow: isCollapsed
          ? "0 8px 18px rgba(0, 0, 0, 0.18)"
          : "var(--elev-2), var(--glow-radar)",
        display: "grid",
        gap: isCollapsed ? 8 : 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: isCollapsed ? "center" : "flex-start",
          gap: 12,
        }}
      >
        <div style={{ display: "grid", gap: isCollapsed ? 0 : 6 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: 0.18,
              textTransform: "uppercase",
              color: "var(--accent-radar)",
            }}
          >
            AI Briefing
          </div>
          {!isCollapsed ? (
            <div
              style={{
                fontSize: 20,
                lineHeight: 1.2,
                color: "var(--text-primary)",
              }}
            >
              Ask Rialo directly from the tower.
            </div>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={isCollapsed ? "Expand AI Briefing" : "Collapse AI Briefing"}
          aria-expanded={!isCollapsed}
          aria-controls={AI_BRIEFING_BODY_ID}
          onClick={() => setIsCollapsed((value) => !value)}
          style={{
            minWidth: isCollapsed ? 64 : 108,
            padding: isCollapsed ? "6px 10px" : "8px 12px",
            border: "1px solid var(--border-emphasis)",
            borderRadius: isCollapsed ? 999 : "var(--radius-sharp)",
            background: isCollapsed ? "rgba(82, 255, 191, 0.12)" : "var(--surface-2)",
            color: isCollapsed ? "var(--accent-radar)" : "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {isCollapsed ? "Open" : "Collapse"}
        </button>
      </div>

      <div
        id={AI_BRIEFING_BODY_ID}
        hidden={isCollapsed}
        style={{ display: "grid", gap: 12 }}
      >
        {!isCollapsed ? (
          <>
            <form
              aria-label="AI Briefing form"
              onSubmit={(event) => {
                event.preventDefault();
                void submitQuestion(question);
              }}
              style={{ display: "grid", gap: 10 }}
            >
              <textarea
                aria-label="AI Briefing question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask about live flights, claim risk, or evidence."
                rows={3}
                style={{
                  width: "100%",
                  resize: "none",
                  minHeight: 88,
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
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    textTransform: "uppercase",
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    {inlineLoading ? connectionStatus : "overview"}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                    gap: 8,
                  }}
                >
                  {inlineLoading ? (
                    <button
                      type="button"
                      aria-label="Stop AI Briefing stream"
                      onClick={stop}
                      style={{
                        minWidth: 92,
                        padding: "10px 14px",
                        border: "1px solid var(--border-emphasis)",
                        borderRadius: "var(--radius-sharp)",
                        background: "var(--surface-2)",
                        color: "var(--text-primary)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        textTransform: "uppercase",
                        cursor: "pointer",
                      }}
                    >
                      Stop
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    aria-label="Submit AI Briefing question"
                    disabled={!canSubmit}
                    style={{
                      minWidth: 112,
                      padding: "10px 14px",
                      border: "1px solid var(--border-emphasis)",
                      borderRadius: "var(--radius-sharp)",
                      background: canSubmit ? "var(--accent-radar)" : "var(--surface-2)",
                      color: canSubmit ? "#05120c" : "var(--text-secondary)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      textTransform: "uppercase",
                      cursor: canSubmit ? "pointer" : "not-allowed",
                    }}
                  >
                    {inlineLoading ? "Replace" : "Ask"}
                  </button>
                </div>
              </div>
            </form>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {recommendations.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setQuestion(prompt)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 34,
                    maxWidth: "100%",
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: `1px solid ${
                      selectedPrompt === prompt
                        ? "var(--accent-radar)"
                        : "var(--border-emphasis)"
                    }`,
                    background:
                      selectedPrompt === prompt
                        ? "rgba(82, 255, 191, 0.12)"
                        : "var(--surface-2)",
                    color:
                      selectedPrompt === prompt
                        ? "var(--accent-radar)"
                        : "var(--text-primary)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    lineHeight: 1.4,
                    textAlign: "left",
                    cursor: "pointer",
                    whiteSpace: "normal",
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {(inlineResponse || inlineError || inlineLoading) && isOverviewActive ? (
              <section
                className="ai-briefing-answer-scroll"
                data-testid="ai-briefing-answer-scroll"
                style={{
                  padding: "14px 18px 12px 14px",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-soft)",
                  background: "rgba(20, 24, 31, 0.82)",
                  display: "grid",
                  gap: 10,
                  maxHeight: 260,
                  overflowY: "auto",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    color:
                      inlineError && !inlineLoading
                        ? "var(--warn-amber)"
                        : "var(--accent-radar)",
                  }}
                >
                  {inlineAnswerHeading}
                </div>
                {hasInlineAnswer || inlineLoading ? (
                  <div
                    style={{
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: "var(--text-primary)",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {inlineResponse?.answer ?? ""}
                    {inlineLoading ? (
                      <span
                        aria-hidden="true"
                        style={{
                          marginLeft: 4,
                          color: "var(--accent-radar)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        ▌
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {inlineLoading ? (
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <span>Receiving answer</span>
                    <span>{connectionStatus}</span>
                  </div>
                ) : null}
                {inlineError ? (
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--warn-amber)",
                      lineHeight: 1.5,
                    }}
                  >
                    {inlineError}
                  </div>
                ) : null}
                {!inlineLoading && hasInlineAnswer && visibleEvidence.length ? (
                  <div
                    style={{
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
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
                        gap: 6,
                      }}
                    >
                      {visibleEvidence.map((source) => (
                        <span
                          key={`${source.type}:${source.id}`}
                          style={{
                            padding: "6px 8px",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "var(--radius-sharp)",
                            color: "var(--text-secondary)",
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            lineHeight: 1.3,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {source.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
