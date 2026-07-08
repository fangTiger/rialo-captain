import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PresetCards } from "../components/studio/PresetCards";

describe("PresetCards", () => {
  it("renders the three studio presets with the steady rule selected", () => {
    render(<PresetCards selectedPreset="steady" onPresetChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Steady Skies/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Storm Chaser/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hub Hunter/ })).toBeInTheDocument();
    expect(screen.getAllByText("30m delay")).toHaveLength(3);
    expect(screen.getByText("3.0x payout")).toBeInTheDocument();
    expect(screen.getAllByText("Hubs included")).toHaveLength(3);
  });

  it("emits the selected preset and its default rule", () => {
    const onPresetChange = vi.fn();
    render(<PresetCards selectedPreset="steady" onPresetChange={onPresetChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Storm Chaser/ }));

    expect(onPresetChange).toHaveBeenCalledWith({
      id: "storm",
      name: "Storm Chaser",
      rule: {
        delay_threshold_min: 30,
        payout_multiplier: 5,
        include_hubs: true,
        exclude_thunderstorm: false,
        cover_red_eye: true,
      },
    });
  });
});
