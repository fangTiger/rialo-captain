import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const evidenceTimeFormatterOptions: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};
const hanTextPattern = /\p{Script=Han}/u;

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

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a loading state", () => {
    vi.mocked(useEvidenceTimeline).mockReturnValue(
      makeHookState({ isLoading: true }),
    );

    render(<EvidenceDrawer subject={subject} onClose={() => {}} />);

    expect(screen.getByText(/loading evidence timeline/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Play evidence story" }),
    ).not.toBeInTheDocument();
  });

  it("formats evidence timestamps with a fixed English locale", () => {
    const expectedTime = new Intl.DateTimeFormat(
      "en-US",
      evidenceTimeFormatterOptions,
    ).format(new Date(1_718_000_000_000));
    const formatterSpy = vi.spyOn(Intl, "DateTimeFormat");

    vi.mocked(useEvidenceTimeline).mockReturnValue(
      makeHookState({
        timeline: makeTimeline([
          {
            id: "event-time",
            type: "claim.settled",
            title: "Claim settled",
            source: "claim_engine",
            created_at: 1_718_000_000,
            payload: {},
          },
        ]),
        events: [
          {
            id: "event-time",
            type: "claim.settled",
            title: "Claim settled",
            source: "claim_engine",
            created_at: 1_718_000_000,
            payload: {},
          },
        ],
      }),
    );

    render(<EvidenceDrawer subject={subject} onClose={() => {}} />);

    expect(screen.getByText(expectedTime)).toBeInTheDocument();
    expect(expectedTime).not.toMatch(hanTextPattern);
    expect(formatterSpy).toHaveBeenCalledWith(
      "en-US",
      expect.objectContaining(evidenceTimeFormatterOptions),
    );
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

  it("renders a command center settlement path without treating contextual signals as evidence", () => {
    vi.mocked(useEvidenceTimeline).mockReturnValue(
      makeHookState({
        timeline: makeTimeline([
          {
            id: "event-condition",
            type: "condition.matched",
            title: "Condition matched",
            source: "claim_engine",
            created_at: 1_718_000_000,
            payload: {
              observed_delay_minutes: 45,
              threshold_minutes: 30,
            },
          },
          {
            id: "event-triggered",
            type: "claim.triggered",
            title: "Claim triggered",
            source: "claim_engine",
            created_at: 1_718_000_100,
            payload: {
              claim_id: "claim-77",
            },
          },
          {
            id: "event-settled",
            type: "claim.settled",
            title: "Claim settled",
            source: "claim_engine",
            created_at: 1_718_000_200,
            payload: {
              tx_hash: "0xabc123",
            },
          },
          {
            id: "event-context",
            type: "market.signal",
            title: "Market risk signal",
            source: "risk_intelligence",
            created_at: 1_718_000_250,
            payload: {
              probability: 0.72,
            },
          },
          {
            id: "event-credit",
            type: "balance.credited",
            title: "Balance credited",
            source: "ledger",
            created_at: 1_718_000_300,
            payload: {
              ledger_entry_id: "ledger-99",
            },
          },
        ]),
        events: [
          {
            id: "event-condition",
            type: "condition.matched",
            title: "Condition matched",
            source: "claim_engine",
            created_at: 1_718_000_000,
            payload: {
              observed_delay_minutes: 45,
              threshold_minutes: 30,
            },
          },
          {
            id: "event-triggered",
            type: "claim.triggered",
            title: "Claim triggered",
            source: "claim_engine",
            created_at: 1_718_000_100,
            payload: {
              claim_id: "claim-77",
            },
          },
          {
            id: "event-settled",
            type: "claim.settled",
            title: "Claim settled",
            source: "claim_engine",
            created_at: 1_718_000_200,
            payload: {
              tx_hash: "0xabc123",
            },
          },
          {
            id: "event-context",
            type: "market.signal",
            title: "Market risk signal",
            source: "risk_intelligence",
            created_at: 1_718_000_250,
            payload: {
              probability: 0.72,
            },
          },
          {
            id: "event-credit",
            type: "balance.credited",
            title: "Balance credited",
            source: "ledger",
            created_at: 1_718_000_300,
            payload: {
              ledger_entry_id: "ledger-99",
            },
          },
        ],
      }),
    );

    render(<EvidenceDrawer subject={subject} onClose={() => {}} />);

    const dialog = screen.getByRole("dialog", { name: /claim evidence/i });
    expect(dialog).toHaveClass("command-surface", "command-safe-area");

    const pathPanel = screen.getByRole("region", {
      name: /settlement evidence path/i,
    });
    expect(pathPanel).toHaveClass("command-panel", "command-surface");
    expect(
      screen.getByLabelText("Settlement evidence metrics"),
    ).toHaveAttribute("role", "list");
    expect(
      screen.getByText(/Contextual signals are not settlement evidence/i),
    ).toBeInTheDocument();

    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Condition matched"),
        expect.stringContaining("Claim triggered"),
        expect.stringContaining("Claim settled"),
        expect.stringContaining("Market risk signal"),
        expect.stringContaining("Balance credited"),
      ]),
    );

    const settledRow = screen.getByTestId("evidence-row-event-settled");
    expect(settledRow).toHaveAttribute("data-evidence-kind", "settlement");
    expect(within(settledRow).getByText("Settlement evidence")).toBeInTheDocument();
    expect(within(settledRow).queryByText("Contextual signal")).not.toBeInTheDocument();

    const contextualRow = screen.getByTestId("evidence-row-event-context");
    expect(contextualRow).toHaveAttribute(
      "data-evidence-kind",
      "contextual-signal",
    );
    expect(within(contextualRow).getByText("Contextual signal")).toBeInTheDocument();
    expect(
      within(contextualRow).queryByText("Settlement evidence"),
    ).not.toBeInTheDocument();
  });

  it("renders English fallback titles for legacy Chinese evidence events", () => {
    vi.mocked(useEvidenceTimeline).mockReturnValue(
      makeHookState({
        timeline: makeTimeline([
          {
            id: "event-legacy",
            type: "claim.settled",
            title: "赔付已结算",
            source: "mock-chain",
            created_at: 1_718_000_000,
            payload: {
              tx_hash: "0xlegacy",
            },
          },
        ]),
        events: [
          {
            id: "event-legacy",
            type: "claim.settled",
            title: "赔付已结算",
            source: "mock-chain",
            created_at: 1_718_000_000,
            payload: {
              tx_hash: "0xlegacy",
            },
          },
        ],
      }),
    );

    render(<EvidenceDrawer subject={subject} onClose={() => {}} />);

    expect(screen.getByText("Claim settled")).toBeInTheDocument();
    expect(screen.queryByText("赔付已结算")).not.toBeInTheDocument();
  });

  it("falls back to the event type title when a known event title is blank", () => {
    vi.mocked(useEvidenceTimeline).mockReturnValue(
      makeHookState({
        timeline: makeTimeline([
          {
            id: "event-blank",
            type: "claim.settled",
            title: "   ",
            source: "mock-chain",
            created_at: 1_718_000_000,
            payload: {
              tx_hash: "0xblank",
            },
          },
        ]),
        events: [
          {
            id: "event-blank",
            type: "claim.settled",
            title: "   ",
            source: "mock-chain",
            created_at: 1_718_000_000,
            payload: {
              tx_hash: "0xblank",
            },
          },
        ],
      }),
    );

    render(<EvidenceDrawer subject={subject} onClose={() => {}} />);

    expect(screen.getByText("Claim settled")).toBeInTheDocument();
  });

  it("keeps a normal English title for unknown event types", () => {
    vi.mocked(useEvidenceTimeline).mockReturnValue(
      makeHookState({
        timeline: makeTimeline([
          {
            id: "event-unknown",
            type: "audit.reviewed",
            title: "Manual review complete",
            source: "analyst",
            created_at: 1_718_000_000,
            payload: {},
          },
        ]),
        events: [
          {
            id: "event-unknown",
            type: "audit.reviewed",
            title: "Manual review complete",
            source: "analyst",
            created_at: 1_718_000_000,
            payload: {},
          },
        ],
      }),
    );

    render(<EvidenceDrawer subject={subject} onClose={() => {}} />);

    expect(screen.getByText("Manual review complete")).toBeInTheDocument();
  });

  it("renders a themed scrollbar stylesheet for the evidence timeline scroller", () => {
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
            },
          },
        ],
      }),
    );

    render(<EvidenceDrawer subject={subject} onClose={() => {}} />);

    expect(screen.getByTestId("evidence-drawer-scroll")).toBeInTheDocument();

    const stylesheet = Array.from(document.querySelectorAll("style"))
      .map((element) => element.textContent ?? "")
      .join("\n");

    expect(stylesheet).toContain(".evidence-drawer-scroll");
    expect(stylesheet).toContain("scrollbar-color");
    expect(stylesheet).toContain("scrollbar-width: thin");
    expect(stylesheet).toContain("::-webkit-scrollbar-thumb");
    expect(stylesheet).toContain("var(--accent-radar)");
  });

  it("shows story playback controls, the active counter, and highlights the active event", () => {
    vi.mocked(useEvidenceTimeline).mockReturnValue(
      makeHookState({
        timeline: makeTimeline([
          {
            id: "event-1",
            type: "claim.triggered",
            title: "Claim triggered",
            source: "claim_engine",
            created_at: 1_718_000_000,
            payload: {
              delay_minutes: 45,
            },
          },
          {
            id: "event-2",
            type: "claim.settled",
            title: "Claim settled",
            source: "claim_engine",
            created_at: 1_718_000_100,
            payload: {
              tx_hash: "0xabc123",
            },
          },
        ]),
        events: [
          {
            id: "event-1",
            type: "claim.triggered",
            title: "Claim triggered",
            source: "claim_engine",
            created_at: 1_718_000_000,
            payload: {
              delay_minutes: 45,
            },
          },
          {
            id: "event-2",
            type: "claim.settled",
            title: "Claim settled",
            source: "claim_engine",
            created_at: 1_718_000_100,
            payload: {
              tx_hash: "0xabc123",
            },
          },
        ],
      }),
    );

    render(<EvidenceDrawer subject={subject} onClose={() => {}} />);

    expect(
      screen.getByRole("button", { name: "Play evidence story" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Previous evidence event" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Next evidence event" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    const eventList = screen.getByTestId("evidence-event-list");
    expect(within(eventList).getAllByRole("listitem")[0]).toHaveAttribute(
      "aria-current",
      "step",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Next evidence event" }),
    );

    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(within(eventList).getAllByRole("listitem")[1]).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("plays and pauses the evidence story without refetching timeline events", () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    vi.mocked(useEvidenceTimeline).mockReturnValue(
      makeHookState({
        timeline: makeTimeline([
          {
            id: "event-1",
            type: "claim.triggered",
            title: "Claim triggered",
            source: "claim_engine",
            created_at: 1_718_000_000,
            payload: {
              delay_minutes: 45,
            },
          },
          {
            id: "event-2",
            type: "claim.settled",
            title: "Claim settled",
            source: "claim_engine",
            created_at: 1_718_000_100,
            payload: {
              tx_hash: "0xabc123",
            },
          },
          {
            id: "event-3",
            type: "flight.landed",
            title: "Flight landed",
            source: "flight_feed",
            created_at: 1_718_000_200,
            payload: {
              landed_at: 1_718_000_200,
            },
          },
        ]),
        events: [
          {
            id: "event-1",
            type: "claim.triggered",
            title: "Claim triggered",
            source: "claim_engine",
            created_at: 1_718_000_000,
            payload: {
              delay_minutes: 45,
            },
          },
          {
            id: "event-2",
            type: "claim.settled",
            title: "Claim settled",
            source: "claim_engine",
            created_at: 1_718_000_100,
            payload: {
              tx_hash: "0xabc123",
            },
          },
          {
            id: "event-3",
            type: "flight.landed",
            title: "Flight landed",
            source: "flight_feed",
            created_at: 1_718_000_200,
            payload: {
              landed_at: 1_718_000_200,
            },
          },
        ],
        refresh,
      }),
    );

    render(<EvidenceDrawer subject={subject} onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Play evidence story" }));

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pause evidence story" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Pause evidence story" }),
    );

    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
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
    expect(
      screen.queryByRole("button", { name: "Play evidence story" }),
    ).not.toBeInTheDocument();
  });

  it("renders an error state", () => {
    vi.mocked(useEvidenceTimeline).mockReturnValue(
      makeHookState({
        error: new Error("timeline unavailable"),
      }),
    );

    render(<EvidenceDrawer subject={subject} onClose={() => {}} />);

    expect(screen.getByText(/timeline unavailable/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Play evidence story" }),
    ).not.toBeInTheDocument();
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
