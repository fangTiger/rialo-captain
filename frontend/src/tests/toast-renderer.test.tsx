import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastRenderer } from "../components/shell/ToastRenderer";
import { useEventStore } from "../store/eventStore";

describe("ToastRenderer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEventStore.setState({
      flares: [],
      toasts: [],
      events: [],
      wsState: "idle",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders toast messages from the event store", () => {
    useEventStore.getState().addToast({ id: "t1", message: "Policy created" });

    render(<ToastRenderer />);

    expect(screen.getByText("Policy created")).toBeInTheDocument();
  });

  it("automatically dismisses each toast after three seconds", () => {
    useEventStore.getState().addToast({ id: "t1", message: "Auto dismiss" });
    render(<ToastRenderer />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText("Auto dismiss")).not.toBeInTheDocument();
    expect(useEventStore.getState().toasts).toHaveLength(0);
  });

  it("dismisses a toast when clicked", () => {
    useEventStore.getState().addToast({ id: "t1", message: "Click dismiss" });
    render(<ToastRenderer />);

    fireEvent.click(screen.getByText("Click dismiss"));

    expect(screen.queryByText("Click dismiss")).not.toBeInTheDocument();
    expect(useEventStore.getState().toasts).toHaveLength(0);
  });
});
