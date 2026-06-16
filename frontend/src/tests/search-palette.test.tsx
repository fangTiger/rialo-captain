import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchPalette } from "../components/search/SearchPalette";

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useLocation: () => ({ pathname: "/policies" }),
    useNavigate: () => navigateMock,
  };
});

vi.mock("../hooks/useSearchFlights", () => ({
  useSearchFlights: (query: string) => {
    const flights = [
      flight("UAL2351", "SFO", "JFK", 0.32),
      flight("UAL2360", "LAX", "BOS", 0.18),
      flight("UAL2415", null, null, 0.06),
      ...Array.from({ length: 9 }, (_, index) =>
        flight(`UAL25${String(index).padStart(2, "0")}`, "SFO", "ORD", 0.44),
      ),
    ];
    if (query === "loading") {
      return { results: [], totalMatches: 0, isLoading: true };
    }
    if (!query.trim()) return { results: [], totalMatches: 0, isLoading: false };
    const matches = flights.filter(
      (item) =>
        item.callsign.includes(query.toUpperCase()) ||
        item.origin?.includes(query.toUpperCase()) ||
        item.destination?.includes(query.toUpperCase()),
    );
    return {
      results: matches.slice(0, 10),
      totalMatches: matches.length,
      isLoading: false,
    };
  },
}));

function flight(
  callsign: string,
  origin: string | null,
  destination: string | null,
  delayRate: number,
) {
  return {
    id: `${callsign}-20260616`,
    flight_id: `${callsign}-20260616`,
    icao24: callsign.toLowerCase(),
    callsign,
    origin_country: "United States",
    longitude: -122.38,
    latitude: 37.62,
    velocity: 240,
    heading: 90,
    on_ground: false,
    origin,
    destination,
    delay_rate: delayRate,
  };
}

describe("SearchPalette", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("does not render when closed and renders modal when open", () => {
    const { rerender } = render(<SearchPalette open={false} onClose={vi.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<SearchPalette open={true} onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Search flights" })).toBeInTheDocument();
    expect(screen.getByLabelText("Flight search query")).toHaveFocus();
  });

  it("renders results after typing", () => {
    render(<SearchPalette open={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Flight search query"), {
      target: { value: "UAL" },
    });

    expect(screen.getByText("UAL2351")).toBeInTheDocument();
    expect(screen.getByText("SFO → JFK")).toBeInTheDocument();
    expect(screen.getByText("32%")).toBeInTheDocument();
  });

  it("updates selected row with arrow keys", () => {
    render(<SearchPalette open={true} onClose={vi.fn()} />);
    const input = screen.getByLabelText("Flight search query");
    fireEvent.change(input, { target: { value: "UAL" } });

    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(screen.getByRole("button", { name: /Open flight UAL2360/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(input, { key: "ArrowUp" });

    expect(screen.getByRole("button", { name: /Open flight UAL2351/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("navigates from current pathname on enter", () => {
    const onClose = vi.fn();
    render(<SearchPalette open={true} onClose={onClose} />);
    const input = screen.getByLabelText("Flight search query");
    fireEvent.change(input, { target: { value: "UAL" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    fireEvent.keyDown(input, { key: "Enter" });

    expect(navigateMock).toHaveBeenCalledWith("/flight/UAL2360-20260616", {
      state: { from: "/policies" },
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("navigates when clicking a result row", () => {
    const onClose = vi.fn();
    render(<SearchPalette open={true} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Flight search query"), {
      target: { value: "UAL" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Open flight UAL2415/ }));

    expect(navigateMock).toHaveBeenCalledWith("/flight/UAL2415-20260616", {
      state: { from: "/policies" },
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on escape and overlay click", () => {
    const onClose = vi.fn();
    render(<SearchPalette open={true} onClose={onClose} />);

    fireEvent.keyDown(screen.getByLabelText("Flight search query"), { key: "Escape" });
    fireEvent.click(screen.getByTestId("search-overlay"));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders empty, no-match, loading, and overflow states", () => {
    render(<SearchPalette open={true} onClose={vi.fn()} />);
    const input = screen.getByLabelText("Flight search query");

    expect(
      screen.getByText("Type a callsign or airport code · e.g. SFO, JFK, UAL2351"),
    ).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "XYZ999" } });
    expect(screen.getByText('No flight matches "XYZ999"')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "loading" } });
    expect(input).toHaveAttribute("placeholder", "Loading flights...");

    fireEvent.change(input, { target: { value: "UAL" } });
    expect(screen.getByText("+2 more · refine your query")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
