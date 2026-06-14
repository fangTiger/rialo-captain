import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReactiveDiagram } from "../components/rialo/ReactiveDiagram";
import { RialoInside } from "../routes/RialoInside";

describe("RialoInside", () => {
  it("renders the hero, comparison diagram, and closing copy", () => {
    render(<RialoInside />);

    expect(screen.getAllByText("RIALO INSIDE")).toHaveLength(1);
    expect(screen.getByText(/Six roles/)).toBeInTheDocument();
    expect(screen.getByText("TRADITIONAL")).toBeInTheDocument();
    expect(screen.getByText("RIALO")).toBeInTheDocument();
    expect(screen.getByText("Oracle service")).toBeInTheDocument();
    expect(screen.getByText("Reactive Contract")).toBeInTheDocument();
    expect(screen.getByText(/The Tower/)).toBeInTheDocument();
  });
});

describe("ReactiveDiagram", () => {
  let top = 600;
  let rectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    top = 600;
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 600,
      writable: true,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return 600;
      },
    });
    rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(
        () =>
          ({
            top,
            bottom: top + 600,
            left: 0,
            right: 1280,
            width: 1280,
            height: 600,
            x: 0,
            y: top,
            toJSON: () => ({}),
          }) as DOMRect,
      );
  });

  afterEach(() => {
    rectSpy.mockRestore();
    delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
  });

  it("lights stages from scroll progress and keeps later stages dim", async () => {
    render(<ReactiveDiagram />);

    await waitFor(() =>
      expect(screen.getByText("Oracle service")).toHaveStyle({ opacity: "0.2" }),
    );

    top = 300;
    fireEvent.scroll(window);

    await waitFor(() =>
      expect(screen.getByText("Oracle service")).toHaveStyle({ opacity: "1" }),
    );
    expect(screen.getByText("Keeper bot")).toHaveStyle({ opacity: "0.2" });
    expect(screen.getByText("Contract")).toHaveStyle({ opacity: "0.2" });
    screen
      .getAllByText("User")
      .forEach((node) => expect(node).toHaveStyle({ opacity: "1" }));
  });
});
