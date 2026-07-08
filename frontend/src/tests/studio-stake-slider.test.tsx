import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PoolRule } from "../api/pool";
import { StakeSlider, estimatePoolOutlook } from "../components/studio/StakeSlider";

const baseRule: PoolRule = {
  delay_threshold_min: 30,
  payout_multiplier: 3,
  include_hubs: true,
  exclude_thunderstorm: true,
  cover_red_eye: false,
};

describe("StakeSlider", () => {
  it("calculates deterministic expected 7d pool outlook", () => {
    expect(estimatePoolOutlook(baseRule, 200)).toEqual({
      expectedHits7d: 7,
      expectedPl7d: 42,
    });
  });

  it("renders stake controls, expected metrics, and open CTA", () => {
    const onStakeChange = vi.fn();
    const onOpen = vi.fn();

    render(
      <StakeSlider
        canOpen
        onOpen={onOpen}
        onStakeChange={onStakeChange}
        rule={baseRule}
        stake={200}
      />,
    );

    expect(screen.getByText("Stake 200 RIA")).toBeInTheDocument();
    expect(screen.getByText("Expected 7d hits")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("+42 RIA")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("slider", { name: "Stake" }), {
      target: { value: "300" },
    });
    fireEvent.click(screen.getByRole("button", { name: "OPEN POOL ▸" }));

    expect(onStakeChange).toHaveBeenCalledWith(300);
    expect(onOpen).toHaveBeenCalled();
  });

  it("disables the CTA when the pool cannot be opened", () => {
    render(
      <StakeSlider
        canOpen={false}
        onOpen={vi.fn()}
        onStakeChange={vi.fn()}
        rule={baseRule}
        stake={500}
      />,
    );

    expect(screen.getByRole("button", { name: "OPEN POOL ▸" })).toBeDisabled();
    expect(screen.getByText("Balance required before opening")).toBeInTheDocument();
  });
});
