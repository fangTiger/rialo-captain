import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RuleLine } from "../components/studio/RuleLine";
import type { PoolRule } from "../api/pool";

const baseRule: PoolRule = {
  delay_threshold_min: 30,
  payout_multiplier: 3,
  include_hubs: true,
  exclude_thunderstorm: true,
  cover_red_eye: false,
};

describe("RuleLine", () => {
  it("renders the editable one-line rule", () => {
    render(<RuleLine rule={baseRule} onChange={vi.fn()} />);

    expect(screen.getByText("Delay at least 30m")).toBeInTheDocument();
    expect(screen.getByText("3.0x payout")).toBeInTheDocument();
    expect(screen.getByText("Hubs included")).toBeInTheDocument();
    expect(screen.getByText("Storms excluded")).toBeInTheDocument();
    expect(screen.getByText("Red-eye off")).toBeInTheDocument();
  });

  it("opens a popover and writes numeric rule edits back", () => {
    const onChange = vi.fn();
    render(<RuleLine rule={baseRule} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit delay threshold" }));
    const dialog = screen.getByRole("dialog", { name: "Edit delay threshold" });
    fireEvent.change(within(dialog).getByLabelText("Delay threshold"), {
      target: { value: "45" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(onChange).toHaveBeenCalledWith({
      ...baseRule,
      delay_threshold_min: 45,
    });
  });

  it("edits boolean chips through the same popover contract", () => {
    const onChange = vi.fn();
    render(<RuleLine rule={baseRule} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit red-eye coverage" }));
    const dialog = screen.getByRole("dialog", { name: "Edit red-eye coverage" });
    fireEvent.click(within(dialog).getByLabelText("Cover red-eye flights"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(onChange).toHaveBeenCalledWith({
      ...baseRule,
      cover_red_eye: true,
    });
  });
});
