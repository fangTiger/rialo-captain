import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EvidenceDrawer } from "../components/evidence/EvidenceDrawer";
import {
  useEvidenceTimeline,
  type EvidenceEvent,
  type EvidenceSubject,
  type EvidenceTimeline,
} from "../hooks/useEvidenceTimeline";

vi.mock("../hooks/useEvidenceTimeline", () => ({
  useEvidenceTimeline: vi.fn(),
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

describe("EvidenceDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
