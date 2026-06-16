import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchHotkey } from "../components/search/SearchHotkey";

vi.mock("../components/search/SearchPalette", () => ({
  SearchPalette: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog" aria-label="Search flights">
        <button type="button" onClick={onClose}>
          close
        </button>
      </div>
    ) : null,
}));

function renderHotkey(pathname = "/", extra?: React.ReactNode) {
  return render(
    <MemoryRouter
      initialEntries={[pathname]}
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      {extra}
      <SearchHotkey />
    </MemoryRouter>,
  );
}

describe("SearchHotkey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens search on slash", () => {
    renderHotkey("/");

    fireEvent.keyDown(window, { key: "/" });

    expect(screen.getByRole("dialog", { name: "Search flights" })).toBeInTheDocument();
  });

  it("opens search on Cmd+K and prevents default", () => {
    renderHotkey("/claims");
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });

    fireEvent(window, event);

    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole("dialog", { name: "Search flights" })).toBeInTheDocument();
  });

  it("opens search on Ctrl+K", () => {
    renderHotkey("/routes");

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(screen.getByRole("dialog", { name: "Search flights" })).toBeInTheDocument();
  });

  it("ignores slash while an input is focused but still handles Cmd+K", () => {
    renderHotkey("/", <input aria-label="premium" />);
    screen.getByLabelText("premium").focus();

    fireEvent.keyDown(window, { key: "/" });

    expect(screen.queryByRole("dialog", { name: "Search flights" })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(screen.getByRole("dialog", { name: "Search flights" })).toBeInTheDocument();
  });

  it("does not respond on login route", () => {
    renderHotkey("/login");

    fireEvent.keyDown(window, { key: "/" });
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(screen.queryByRole("dialog", { name: "Search flights" })).not.toBeInTheDocument();
  });
});
