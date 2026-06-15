import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChainBeam } from "../components/cinema/ChainBeam";
import { FlareLand } from "../components/cinema/FlareLand";
import { ShockWave } from "../components/cinema/ShockWave";
import { useReducedMotion } from "../components/cinema/useReducedMotion";

const originalMatchMedia = window.matchMedia;

function installMatchMedia(matches: boolean) {
  let currentMatches = matches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const mediaQueryList = {
    get matches() {
      return currentMatches;
    },
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn(
      (event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === "change") listeners.add(listener);
      },
    ),
    removeEventListener: vi.fn(
      (event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === "change") listeners.delete(listener);
      },
    ),
    addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn(() => mediaQueryList),
  });

  return {
    mediaQueryList,
    setMatches(nextMatches: boolean) {
      currentMatches = nextMatches;
      const event = { matches: nextMatches } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

function ReducedMotionProbe() {
  const reducedMotion = useReducedMotion();
  return <span data-testid="reduced-motion-probe">{String(reducedMotion)}</span>;
}

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  });
  vi.restoreAllMocks();
});

describe("C2 key moment visual components", () => {
  it("renders ShockWave rings without intercepting map gestures", () => {
    render(<ShockWave x={120} y={240} delayMinutes={47} />);

    const shockwave = screen.getByTestId("shockwave");
    expect(shockwave).toHaveStyle({ pointerEvents: "none" });
    expect(shockwave).toHaveStyle({ left: "120px", top: "240px" });
    expect(screen.getByText("47M DELAY")).toBeInTheDocument();

    const rings = screen.getAllByTestId("shockwave-ring");
    expect(rings).toHaveLength(3);
    expect(rings[0]).toHaveClass("shockwave-ring-animated");
    expect(rings[0]).toHaveStyle({ animationName: "shockwave-ring-scale" });
  });

  it("renders ChainBeam line, pulse, and tx label without intercepting map gestures", () => {
    render(
      <ChainBeam
        from={{ x: 120, y: 240 }}
        shortTxHash="0x12345678...abcdef"
        to={{ x: 1000, y: 72 }}
        txHash="0x1234567890abcdef1234567890abcdef12345678"
      />,
    );

    const chainBeam = screen.getByTestId("chainbeam");
    expect(chainBeam).toHaveStyle({ pointerEvents: "none" });

    const line = screen.getByTestId("chainbeam-line");
    expect(line).toHaveAttribute("x1", "120");
    expect(line).toHaveAttribute("y1", "240");
    expect(line).toHaveAttribute("x2", "1000");
    expect(line).toHaveAttribute("y2", "72");

    const pulse = screen.getByTestId("chainbeam-pulse");
    expect(pulse).toHaveClass("chainbeam-pulse-animated");
    expect(pulse).toHaveStyle({ animationName: "chainbeam-pulse-slide" });

    const tx = screen.getByTestId("chainbeam-tx");
    expect(tx).toHaveTextContent("0x12345678...abcdef");
    expect(tx).toHaveStyle({ willChange: "transform" });
  });

  it("renders FlareLand marker without intercepting map gestures", () => {
    render(<FlareLand headingDeg={135} x={320} y={180} />);

    const flareLand = screen.getByTestId("flareland");
    expect(flareLand).toHaveStyle({ pointerEvents: "none" });
    expect(flareLand).toHaveStyle({ left: "320px", top: "180px" });
    expect(screen.getByText("FLARE")).toBeInTheDocument();

    const ring = screen.getByTestId("flareland-ring");
    expect(ring).toHaveClass("flareland-ring-animated");
    expect(ring).toHaveStyle({ animationName: "flareland-ping-scale" });

    const glyph = screen.getByTestId("flareland-heading");
    expect(glyph).toHaveStyle({ transform: "rotate(135deg)" });
  });

  it("uses prefers-reduced-motion to render static key moment states", () => {
    installMatchMedia(true);

    render(
      <>
        <ShockWave delayMinutes={35} x={100} y={110} />
        <ChainBeam
          from={{ x: 100, y: 110 }}
          shortTxHash="0xabcdef12...123456"
          to={{ x: 900, y: 72 }}
          txHash="0xabcdef1234567890abcdef1234567890abcdef12"
        />
        <FlareLand headingDeg={45} x={180} y={210} />
      </>,
    );

    expect(screen.getByTestId("shockwave")).toHaveClass("is-reduced-motion");
    expect(screen.getAllByTestId("shockwave-ring")[0]).toHaveClass(
      "shockwave-ring-static",
    );
    expect(screen.getAllByTestId("shockwave-ring")[0]).not.toHaveClass(
      "shockwave-ring-animated",
    );
    expect(screen.getAllByTestId("shockwave-ring")[0]).toHaveStyle({
      animation: "none",
    });

    expect(screen.getByTestId("chainbeam")).toHaveClass("is-reduced-motion");
    expect(screen.getByTestId("chainbeam-pulse")).toHaveClass(
      "chainbeam-pulse-static",
    );
    expect(screen.getByTestId("chainbeam-pulse")).not.toHaveClass(
      "chainbeam-pulse-animated",
    );
    expect(screen.getByTestId("chainbeam-pulse")).toHaveStyle({
      animation: "none",
    });

    expect(screen.getByTestId("flareland")).toHaveClass("is-reduced-motion");
    expect(screen.getByTestId("flareland-ring")).toHaveClass(
      "flareland-ring-static",
    );
    expect(screen.getByTestId("flareland-ring")).not.toHaveClass(
      "flareland-ring-animated",
    );
    expect(screen.getByTestId("flareland-ring")).toHaveStyle({
      animation: "none",
    });
  });

  it("subscribes to reduced motion preference changes", () => {
    const { mediaQueryList, setMatches } = installMatchMedia(false);

    render(<ReducedMotionProbe />);
    expect(screen.getByTestId("reduced-motion-probe")).toHaveTextContent(
      "false",
    );
    expect(mediaQueryList.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );

    act(() => setMatches(true));

    expect(screen.getByTestId("reduced-motion-probe")).toHaveTextContent("true");
  });
});
