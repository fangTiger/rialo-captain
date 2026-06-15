import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAmbientHeatmap } from "../components/cinema/useAmbientHeatmap";
import type { CinemaEvent } from "../store/eventStore";

const baseTime = new Date("2026-06-15T00:00:00.000Z").getTime();

function policyEvent(id: string, createdAt = baseTime): CinemaEvent {
  return {
    id,
    type: "policy.created",
    payload: {
      policy_id: `policy-${id}`,
      flight_id: "BA178-20260615",
      longitude: -73.78,
      latitude: 40.64,
      created_at: createdAt,
      source: "real",
    },
    receivedAt: createdAt,
  };
}

function HeatmapProbe({ event }: { event?: CinemaEvent | null }) {
  const ambient = useAmbientHeatmap();

  return (
    <>
      <button type="button" onClick={() => event && ambient.addPolicyEvent(event)}>
        add policy
      </button>
      <div data-testid="heat-points">
        {ambient.points.map((point) => point.id).join("|")}
      </div>
      <div data-testid="heat-focus-count">{ambient.focusPoints.length}</div>
    </>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useAmbientHeatmap", () => {
  it("adds a heat point from a policy.created event callback", () => {
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);
    render(<HeatmapProbe event={policyEvent("policy-created-1")} />);

    fireEvent.click(screen.getByText("add policy"));

    expect(screen.getByTestId("heat-points")).toHaveTextContent(
      "policy-created-1:heat",
    );
    expect(screen.getByTestId("heat-focus-count")).toHaveTextContent("1");
  });

  it("prunes stale points on the five minute interval", () => {
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    render(<HeatmapProbe event={policyEvent("old-policy", baseTime)} />);
    fireEvent.click(screen.getByText("add policy"));
    expect(screen.getByTestId("heat-points")).toHaveTextContent(
      "old-policy:heat",
    );

    vi.setSystemTime(baseTime + 300_001);
    act(() => {
      vi.advanceTimersByTime(300_000);
    });

    expect(screen.getByTestId("heat-points")).toHaveTextContent("");
  });

  it("cleans up the prune timer on unmount", () => {
    vi.useFakeTimers();
    const { unmount } = render(<HeatmapProbe />);

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
