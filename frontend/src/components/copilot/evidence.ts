import type { CopilotAnswer, CopilotSource } from "../../api/copilot";

const EVIDENCE_PREFIX = /^(Flight|Policy|Claim|Evidence)\s+(.+)$/i;
const TOKEN_BOUNDARY_CHARS = "a-z0-9";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addVariant(variants: Set<string>, value: string | undefined) {
  if (!value) return;
  const normalized = normalize(value);
  if (normalized.length < 3) return;
  variants.add(normalized);
}

function sourceVariants(source: CopilotSource) {
  const variants = new Set<string>();
  addVariant(variants, source.id);
  addVariant(variants, source.label);

  const prefixedMatch = source.label.match(EVIDENCE_PREFIX);
  if (prefixedMatch) {
    const detail = prefixedMatch[2];
    addVariant(variants, detail);
    addVariant(variants, detail.split(/\s+/)[0]);
  }

  for (const token of source.label.match(/[A-Za-z0-9-]+/g) ?? []) {
    const normalized = normalize(token);
    if (normalized.length < 3) continue;
    if (!/[0-9-]/.test(normalized)) continue;
    variants.add(normalized);
  }

  return [...variants];
}

function sourceMatchesAnswer(answer: string, source: CopilotSource) {
  const normalizedAnswer = normalize(answer);
  if (!normalizedAnswer) return false;
  return sourceVariants(source).some((variant) =>
    new RegExp(
      `(^|[^${TOKEN_BOUNDARY_CHARS}])${escapeRegex(variant)}(?=$|[^${TOKEN_BOUNDARY_CHARS}])`,
    ).test(normalizedAnswer),
  );
}

export function filterEvidenceByAnswer(
  answer: string,
  sources: CopilotSource[],
  limit = 3,
) {
  if (!answer.trim()) {
    return [];
  }

  const matched = sources.filter((source) => sourceMatchesAnswer(answer, source));
  return matched.slice(0, limit);
}

export function hasSuccessfulFinalAnswer(
  response: Pick<CopilotAnswer, "status" | "answer"> | null,
  options: {
    isLoading: boolean;
    errorMessage?: string | null;
  },
) {
  return (
    Boolean(response?.answer.trim()) &&
    response?.status === "ok" &&
    !options.isLoading &&
    !options.errorMessage
  );
}
