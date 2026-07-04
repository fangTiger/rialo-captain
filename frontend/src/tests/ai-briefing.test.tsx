import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AIBriefing } from "../components/copilot/AIBriefing";
import { CopilotProvider } from "../components/copilot/CopilotProvider";

describe("AIBriefing", () => {
  it("starts collapsed and keeps expand controls accessible", () => {
    render(
      <CopilotProvider>
        <AIBriefing />
      </CopilotProvider>,
    );

    const briefing = screen.getByTestId("ai-briefing");
    const expand = screen.getByRole("button", { name: "Expand AI Briefing" });

    expect(briefing).toHaveClass("ai-briefing", "command-surface", "command-panel");
    expect(briefing).toHaveAttribute("data-collapsed", "true");
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(expand).toHaveAttribute("aria-controls", "ai-briefing-body");
    expect(screen.queryByRole("textbox", { name: "AI Briefing question" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("AI Briefing provider status")).toHaveClass(
      "signal-pill",
      "signal-pill--radar",
    );
    expect(screen.getByLabelText("AI Briefing provider status")).toHaveTextContent(
      /provider:\s*deepseek/i,
    );
    expect(screen.queryByText(/fake|mock|offline/i)).not.toBeInTheDocument();

    fireEvent.click(expand);

    expect(briefing).toHaveAttribute("data-collapsed", "false");
    expect(
      screen.getByRole("button", { name: "Collapse AI Briefing" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox", { name: "AI Briefing question" })).toBeInTheDocument();
  });
});
