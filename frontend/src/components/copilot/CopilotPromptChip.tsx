import type { CSSProperties, MouseEvent } from "react";
import type { CopilotSubjectType } from "../../api/copilot";
import { useCopilot } from "./CopilotProvider";

interface CopilotPromptChipProps {
  label: string;
  question?: string;
  subjectType: CopilotSubjectType;
  subjectId?: string;
  tone?: "default" | "muted";
}

const BASE_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 34,
  maxWidth: "100%",
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid var(--border-emphasis)",
  background: "var(--surface-2)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  lineHeight: 1.4,
  textAlign: "left",
  cursor: "pointer",
  whiteSpace: "normal",
};

export function CopilotPromptChip({
  label,
  question,
  subjectType,
  subjectId,
  tone = "default",
}: CopilotPromptChipProps) {
  const { ask } = useCopilot();

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void ask({
      question: question ?? label,
      subjectType,
      subjectId,
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        ...BASE_STYLE,
        background: tone === "muted" ? "transparent" : "var(--surface-2)",
        color: tone === "muted" ? "var(--text-secondary)" : "var(--text-primary)",
        borderColor:
          tone === "muted" ? "var(--border-subtle)" : "var(--border-emphasis)",
      }}
    >
      {label}
    </button>
  );
}
