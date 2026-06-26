import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EvidenceDrawer } from "../components/evidence/EvidenceDrawer";
import {
  useEvidenceTimeline,
  type EvidenceEvent,
  type EvidenceSubject,
  type EvidenceTimeline,
} from "../hooks/useEvidenceTimeline";

const copilotHarness = vi.hoisted(() => ({
  ask: vi.fn(),
  openPanel: vi.fn(),
}));

vi.mock("../hooks/useEvidenceTimeline", () => ({
  useEvidenceTimeline: vi.fn(),
}));

vi.mock("../components/copilot/CopilotProvider", () => ({
  useCopilot: () => copilotHarness,
}));

const subject: EvidenceSubject = { kind: "claim", id: "claim-77" };

function makeTimeline(events: EvidenceEvent[]): EvidenceTimeline {
  return {
    subject: {
      policy_id: "policy-12",
      flight_id: "flight-44",
      claim_id: "claim-77",
    },
    events,
  };
}

function makeHookState(
  overrides: Partial<ReturnType<typeof useEvidenceTimeline>> = {},
) {
  return {
    timeline: null,
    events: [],
    error: null,
    isLoading: false,
    refresh: vi.fn(),
    ...overrides,
  };
}

function appendLauncher() {
  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.textContent = "Open evidence";
  document.body.appendChild(launcher);
  return launcher;
}

describe("EvidenceDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    copilotHarness.ask.mockReset();
    copilotHarness.openPanel.mockReset();
  });

  it("renders a loading state", () => {
    vi.mocked(useEvidenceTimeline).mockReturnValue(
      makeHookState({ isLoading: true }),
    );

    render(<EvidenceDrawer subject={subject} onClose={() => {}} />);

    expect(screen.getByText(/loading evidence timeline/i)).toBeInTheDocument();
  });

  it("renders evidence events with source and payload summary", () => {
    vi.mocked(useEvidenceTimeline).mockReturnValue(
      makeHookState({
        timeline: makeTimeline([
          {
            id: "event-77",
            type: "claim.settled",
            title: "Claim settled",
            source: "claim_engine",
            created_at: 1_718_000_000,
            payload: {
              tx_hash: "0xabc123",
              payout: 88,
            },
          },
        ]),
        events: [
          {
            id: "event-77",
            type: "claim.settled",
            title: "Claim settled",
            source: "claim_engine",
            created_at: 1_718_000_000,
            payload: {
              tx_hash: "0xabc123",
              payout: 88,
            },
          },
        ],
      }),
    );

    render(<EvidenceDrawer subject={subject} onClose={() => {}} />);

    expect(screen.getByText("Claim settled")).toBeInTheDocument();
    expect(screen.getByText("claim_engine")).toBeInTheDocument();
    expect(screen.getByText("claim.settled")).toBeInTheDocument();
    expect(screen.getByText(/tx_hash/i)).toBeInTheDocument();
    expect(screen.getByText(/0xabc123/i)).toBeInTheDocument();
  });

  it("renders modal dialog semantics and moves focus into the drawer", async () => {
    vi.mocked(useEvidenceTimeline).mockReturnValue(makeHookState());

    render(<EvidenceDrawer subject={subject} onClose={() => {}} />);

    const dialog = screen.getByRole("dialog", { name: /claim evidence/i });
    const title = screen.getByRole("heading", { name: "Claim Evidence" });
    const closeButton = screen.getByRole("button", {
      name: /close evidence drawer/i,
    });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", title.id);
    await waitFor(() => expect(closeButton).toHaveFocus());
  });

  it("renders the empty state copy", () => {
    vi.mocked(useEvidenceTimeline).mockReturnValue(
      makeHookState({
        timeline: makeTimeline([]),
        events: [],
      }),
    );

    render(<EvidenceDrawer subject={subject} onClose={() => {}} />);

    expect(screen.getByText("No evidence events yet")).toBeInTheDocument();
  });

  it("renders an error state", () => {
    vi.mocked(useEvidenceTimeline).mockReturnValue(
      makeHookState({
        error: new Error("timeline unavailable"),
      }),
    );

    render(<EvidenceDrawer subject={subject} onClose={() => {}} />);

    expect(screen.getByText(/timeline unavailable/i)).toBeInTheDocument();
  });

  it("closes when the close button is clicked", () => {
    const onClose = vi.fn();
    vi.mocked(useEvidenceTimeline).mockReturnValue(makeHookState());

    render(<EvidenceDrawer subject={subject} onClose={onClose} />);

    fireEvent.click(
      screen.getByRole("button", { name: /close evidence drawer/i }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when Escape is pressed", () => {
    const onClose = vi.fn();
    vi.mocked(useEvidenceTimeline).mockReturnValue(makeHookState());

    render(<EvidenceDrawer subject={subject} onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render or bind keyboard handling when subject is null", () => {
    const onClose = vi.fn();
    vi.mocked(useEvidenceTimeline).mockReturnValue(makeHookState());

    render(<EvidenceDrawer subject={null} onClose={onClose} />);

    expect(
      screen.queryByRole("dialog", { name: /claim evidence/i }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("traps Shift+Tab and Tab inside the drawer", async () => {
    vi.mocked(useEvidenceTimeline).mockReturnValue(makeHookState());

    render(<EvidenceDrawer subject={subject} onClose={() => {}} />);

    const dialog = screen.getByRole("dialog", { name: /claim evidence/i });
    const closeButton = screen.getByRole("button", {
      name: /close evidence drawer/i,
    });

    await waitFor(() => expect(closeButton).toHaveFocus());

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(dialog).toHaveFocus();

    fireEvent.keyDown(window, { key: "Tab" });
    expect(closeButton).toHaveFocus();
  });

  it("restores focus and removes key listeners when subject becomes null", async () => {
    const onClose = vi.fn();
    const launcher = appendLauncher();
    launcher.focus();
    vi.mocked(useEvidenceTimeline).mockReturnValue(makeHookState());

    const { rerender } = render(
      <EvidenceDrawer subject={subject} onClose={onClose} />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /close evidence drawer/i }),
      ).toHaveFocus(),
    );

    rerender(<EvidenceDrawer subject={null} onClose={onClose} />);

    expect(
      screen.queryByRole("dialog", { name: /claim evidence/i }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(launcher).toHaveFocus());

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
    launcher.remove();
  });

  it("restores focus and removes key listeners on unmount", async () => {
    const onClose = vi.fn();
    const launcher = appendLauncher();
    launcher.focus();
    vi.mocked(useEvidenceTimeline).mockReturnValue(makeHookState());

    const { unmount } = render(
      <EvidenceDrawer subject={subject} onClose={onClose} />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /close evidence drawer/i }),
      ).toHaveFocus(),
    );

    unmount();

    await waitFor(() => expect(launcher).toHaveFocus());

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
    launcher.remove();
  });

  it("asks Rialo about the current evidence chain", async () => {
    vi.mocked(useEvidenceTimeline).mockReturnValue(
      makeHookState({
        timeline: makeTimeline([]),
        events: [],
      }),
    );

    render(<EvidenceDrawer subject={subject} onClose={() => {}} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Explain this evidence chain" }),
    );

    expect(copilotHarness.ask).toHaveBeenCalledWith({
      question: "Explain this evidence chain",
      subjectType: "evidence",
      subjectId: "claim-77",
    });
  });
});
