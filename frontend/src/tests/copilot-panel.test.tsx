import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askCopilotStream } from "../api/copilot";
import {
  CopilotProvider,
  useCopilot,
} from "../components/copilot/CopilotProvider";
import { filterEvidenceByAnswer } from "../components/copilot/evidence";
import { RialoCopilotPanel } from "../components/copilot/RialoCopilotPanel";

function AskClaimButton() {
  const { ask } = useCopilot();

  return (
    <button
      type="button"
      onClick={() =>
        void ask({
          question: "Why did this claim pay?",
          subjectType: "claim",
          subjectId: "claim-77",
        })
      }
    >
      Ask Claim
    </button>
  );
}

function OpenCopilotButton() {
  const { openPanel } = useCopilot();

  return (
    <button
      type="button"
      onClick={() => openPanel({ subjectType: "overview", reset: true })}
    >
      Open Ask Rialo
    </button>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-path">{location.pathname}</div>;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

function createSseResponse() {
  const encoder = new TextEncoder();
  let controller:
    | ReadableStreamDefaultController<Uint8Array>
    | undefined;
  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
  });

  return {
    response: new Response(body, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    }),
    pushRaw(chunk: string) {
      controller?.enqueue(encoder.encode(chunk));
    },
    push(event: string, data: unknown) {
      controller?.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
      );
    },
    close() {
      controller?.close();
    },
  };
}

describe("askCopilotStream", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses context, delta, suggestions, and done SSE events", async () => {
    const sse = createSseResponse();
    vi.mocked(globalThis.fetch).mockResolvedValue(sse.response);

    const seen: string[] = [];
    const deltaParts: string[] = [];

    const streamPromise = askCopilotStream(
      {
        question: "What needs attention right now?",
        subjectType: "overview",
      },
      {
        onContext(data) {
          seen.push(`context:${data.subject_type}`);
        },
        onDelta(data) {
          deltaParts.push(data.delta);
          seen.push("delta");
        },
        onSuggestions(data) {
          seen.push(`suggestions:${data.suggested_prompts.length}`);
        },
        onDone(data) {
          seen.push(`done:${data.answer}`);
        },
      },
    );

    sse.push("context", {
      subject_type: "overview",
      sources: [],
      model: "deepseek-v4-pro",
      summary: {},
    });
    sse.push("delta", { delta: "Tower is tracking " });
    sse.push("delta", { delta: "BA178." });
    sse.push("suggestions", {
      suggested_prompts: [
        "Question 1",
        "Question 2",
        "Question 3",
        "Question 4",
        "Question 5",
      ],
    });
    sse.push("done", {
      status: "ok",
      answer: "Tower is tracking BA178.",
      sources: [],
      suggested_prompts: ["Question 1"],
      confidence: 0.8,
      model: "deepseek-v4-pro",
    });
    sse.close();

    await streamPromise;

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0])).toContain(
      "/api/copilot/ask/stream",
    );
    expect(deltaParts.join("")).toBe("Tower is tracking BA178.");
    expect(seen).toEqual([
      "context:overview",
      "delta",
      "delta",
      "suggestions:5",
      "done:Tower is tracking BA178.",
    ]);
  });

  it("parses multiple SSE events delivered in a single stream chunk", async () => {
    const sse = createSseResponse();
    vi.mocked(globalThis.fetch).mockResolvedValue(sse.response);

    const seen: string[] = [];
    const deltaParts: string[] = [];
    const onDone = vi.fn();

    const streamPromise = askCopilotStream(
      {
        question: "What needs attention right now?",
        subjectType: "overview",
      },
      {
        onContext(data) {
          seen.push(`context:${data.subject_type}`);
        },
        onDelta(data) {
          deltaParts.push(data.delta);
          seen.push("delta");
        },
        onSuggestions(data) {
          seen.push(`suggestions:${data.suggested_prompts.length}`);
        },
        onDone(data) {
          onDone(data);
          seen.push(`done:${data.answer}`);
        },
      },
    );

    sse.pushRaw(
      [
        `event: context\ndata: ${JSON.stringify({
          subject_type: "overview",
          sources: [],
          model: "deepseek-v4-pro",
          summary: {},
        })}\n\n`,
        `event: delta\ndata: ${JSON.stringify({ delta: "A" })}\n\n`,
        `event: delta\ndata:{"delta":"B"}\n\n`,
        `event: suggestions\ndata: ${JSON.stringify({
          suggested_prompts: [
            "Question 1",
            "Question 2",
            "Question 3",
            "Question 4",
            "Question 5",
          ],
        })}\n\n`,
        `event: done\ndata: ${JSON.stringify({
          status: "ok",
          answer: "AB",
          sources: [],
          suggested_prompts: ["Question 1"],
          confidence: 0.8,
          model: "deepseek-v4-pro",
        })}\n\n`,
      ].join(""),
    );
    sse.close();

    await expect(streamPromise).resolves.toBeUndefined();

    expect(deltaParts.join("")).toBe("AB");
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        answer: "AB",
      }),
    );
    expect(seen).toEqual([
      "context:overview",
      "delta",
      "delta",
      "suggestions:5",
      "done:AB",
    ]);
  });
});

describe("filterEvidenceByAnswer", () => {
  it("avoids prefix collisions while still matching the cited flight token", () => {
    const sources = [
      {
        type: "flight",
        id: "BA178-20260614",
        label: "Flight BA178 LHR->JFK",
        href: "/flights/BA178-20260614",
      },
      {
        type: "flight",
        id: "BA1781-20260614",
        label: "Flight BA1781 JFK->SFO",
        href: "/flights/BA1781-20260614",
      },
    ];

    expect(
      filterEvidenceByAnswer("BA1781 is now closest to a payout threshold.", sources),
    ).toEqual([sources[1]]);
    expect(
      filterEvidenceByAnswer("Flight BA178 LHR->JFK remains exposed.", sources),
    ).toEqual([sources[0]]);
  });
});

describe("RialoCopilotPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits to /api/copilot/ask/stream and renders answer, matched evidence, and followups", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          answer: "BA178 is the closest flight to a payout threshold right now.",
          sources: [
            {
              type: "flight",
              id: "BA178-20260614",
              label: "Flight BA178",
              href: "/flights/BA178-20260614",
            },
            {
              type: "claim",
              id: "claim-one",
              label: "Claim claim-one",
              href: "/claims/claim-one/timeline",
            },
          ],
          suggested_prompts: ["Which claim should I inspect next?"],
          confidence: 0.91,
          model: "deepseek-v4-pro",
        }),
        { status: 200 },
      ),
    );

    render(
      <MemoryRouter
        initialEntries={["/"]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <CopilotProvider>
          <LocationProbe />
          <OpenCopilotButton />
          <RialoCopilotPanel />
        </CopilotProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /open ask rialo/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /question/i }), {
      target: { value: "What needs attention right now?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit question/i }));

    await waitFor(() =>
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1),
    );

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(String(url)).toContain("/api/copilot/ask/stream");
    expect(JSON.parse(String(init?.body))).toEqual({
      question: "What needs attention right now?",
      subject_type: "overview",
    });

    expect(
      await screen.findByText(
        "BA178 is the closest flight to a payout threshold right now.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Evidence used")).toBeInTheDocument();
    expect(screen.getByText("Flight BA178")).toBeInTheDocument();
    expect(screen.queryByText("Claim claim-one")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Flight BA178" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Claim claim-one" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Flight BA178" }));
    expect(screen.getByTestId("location-path")).toHaveTextContent(
      "/flight/BA178-20260614",
    );
    expect(
      screen.getByRole("button", {
        name: "Which claim should I inspect next?",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Sources")).not.toBeInTheDocument();
  });

  it("renders partial stream output inline and caps suggestions at five", async () => {
    const sse = createSseResponse();
    vi.mocked(globalThis.fetch).mockResolvedValue(sse.response);

    render(
      <MemoryRouter
        initialEntries={["/"]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <CopilotProvider>
          <OpenCopilotButton />
          <RialoCopilotPanel />
        </CopilotProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /open ask rialo/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /question/i }), {
      target: { value: "What needs attention right now?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit question/i }));

    sse.push("context", {
      subject_type: "overview",
      sources: [
        {
          type: "flight",
          id: "BA178-20260614",
          label: "Flight BA178",
          href: "/flights/BA178-20260614",
        },
      ],
      model: "deepseek-v4-pro",
      summary: {},
    });
    sse.push("delta", { delta: "Tower is tracking " });

    const answerStream = await screen.findByLabelText("Answer stream");
    const liveStatus = screen.getByRole("status");

    expect(screen.getByText("Live answer")).toBeInTheDocument();
    expect(answerStream).not.toHaveAttribute("aria-live");
    expect(liveStatus).toHaveTextContent("streaming");
    expect(within(answerStream).getByText("Tower is tracking")).toBeInTheDocument();
    expect(screen.getByText("▌")).toBeInTheDocument();
    expect(
      screen.queryByText("Streaming the current Rialo answer..."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Evidence used")).not.toBeInTheDocument();

    sse.push("delta", { delta: "BA178." });
    sse.push("suggestions", {
      suggested_prompts: [
        "Question 1",
        "Question 2",
        "Question 3",
        "Question 4",
        "Question 5",
        "Question 6",
        "Question 7",
      ],
    });
    sse.push("done", {
      status: "ok",
      answer: "Tower is tracking BA178.",
      sources: [
        {
          type: "flight",
          id: "BA178-20260614",
          label: "Flight BA178",
          href: "/flights/BA178-20260614",
        },
      ],
      suggested_prompts: [
        "Question 1",
        "Question 2",
        "Question 3",
        "Question 4",
        "Question 5",
        "Question 6",
      ],
      confidence: 0.8,
      model: "deepseek-v4-pro",
    });
    sse.close();

    expect(
      await screen.findByText("Tower is tracking BA178."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/streaming/i)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Answer ready");
    expect(screen.getByText("Answer")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Question 6" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Question 5" })).toBeInTheDocument();
    expect(screen.getByText("Evidence used")).toBeInTheDocument();
  });

  it("keeps partial stream output when the stream ends without a terminal event", async () => {
    const sse = createSseResponse();
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(sse.response)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "ok",
            answer: "Fallback answer should not replace partial stream text.",
            sources: [],
            suggested_prompts: [],
            confidence: 0.8,
            model: "deepseek-v4-pro",
          }),
          { status: 200 },
        ),
      );

    render(
      <MemoryRouter
        initialEntries={["/"]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <CopilotProvider>
          <OpenCopilotButton />
          <RialoCopilotPanel />
        </CopilotProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /open ask rialo/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /question/i }), {
      target: { value: "What needs attention right now?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit question/i }));

    sse.push("context", {
      subject_type: "overview",
      sources: [],
      model: "deepseek-v4-pro",
      summary: {},
    });
    sse.push("delta", { delta: "Partial tower answer." });
    sse.close();

    expect(await screen.findByText("Partial tower answer.")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText("Rialo Copilot stream ended unexpectedly."),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByText("Fallback answer should not replace partial stream text."),
    ).not.toBeInTheDocument();
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });

  it("keeps partial stream output after an error but hides evidence until a successful final answer", async () => {
    const sse = createSseResponse();
    vi.mocked(globalThis.fetch).mockResolvedValue(sse.response);

    render(
      <MemoryRouter
        initialEntries={["/"]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <CopilotProvider>
          <OpenCopilotButton />
          <RialoCopilotPanel />
        </CopilotProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /open ask rialo/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /question/i }), {
      target: { value: "What needs attention right now?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit question/i }));

    sse.push("context", {
      subject_type: "overview",
      sources: [
        {
          type: "flight",
          id: "BA178-20260614",
          label: "Flight BA178",
          href: "/flights/BA178-20260614",
        },
      ],
      model: "deepseek-v4-pro",
      summary: {},
    });
    sse.push("delta", { delta: "BA178 is still closest to the payout threshold." });
    sse.push("error", {
      code: "timeout",
      message: "DeepSeek request timed out. Please try again.",
    });
    sse.close();

    expect(
      await screen.findByText("BA178 is still closest to the payout threshold."),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("DeepSeek request timed out. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Evidence used")).not.toBeInTheDocument();
    expect(screen.queryByText("Flight BA178")).not.toBeInTheDocument();
  });

  it("renders unavailable responses with answer and model/status hints", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "unavailable",
          answer: "Rialo Copilot is not configured in this environment yet.",
          sources: [],
          suggested_prompts: ["Try again after DeepSeek is connected."],
          confidence: 0,
          model: "deepseek-v4-flash",
        }),
        { status: 200 },
      ),
    );

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <CopilotProvider>
          <OpenCopilotButton />
          <RialoCopilotPanel />
        </CopilotProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /open ask rialo/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /question/i }), {
      target: { value: "Can you brief me anyway?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit question/i }));

    expect(
      await screen.findByText(
        "Rialo Copilot is not configured in this environment yet.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/status: unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/model: deepseek-v4-flash/i)).toBeInTheDocument();
  });

  it("hides the evidence section when the answer does not cite any source", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          answer: "Tower risk is elevated overall today.",
          sources: [
            {
              type: "flight",
              id: "BA178-20260614",
              label: "Flight BA178",
              href: "/flights/BA178-20260614",
            },
          ],
          suggested_prompts: ["What changed most recently?"],
          confidence: 0.5,
          model: "deepseek-v4-pro",
        }),
        { status: 200 },
      ),
    );

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <CopilotProvider>
          <OpenCopilotButton />
          <RialoCopilotPanel />
        </CopilotProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /open ask rialo/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /question/i }), {
      target: { value: "What needs attention right now?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit question/i }));

    expect(await screen.findByText("Tower risk is elevated overall today.")).toBeInTheDocument();
    expect(screen.queryByText("Evidence used")).not.toBeInTheDocument();
    expect(screen.queryByText("Flight BA178")).not.toBeInTheDocument();
  });

  it("restores a clean overview scope after reopening from the global entry", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "ok",
            answer: "Claim 77 paid because delay exceeded the threshold.",
            sources: [],
            suggested_prompts: [],
            confidence: 0.88,
            model: "deepseek-v4-pro",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "ok",
            answer: "Overview refreshed.",
            sources: [],
            suggested_prompts: [],
            confidence: 0.9,
            model: "deepseek-v4-pro",
          }),
          { status: 200 },
        ),
      );

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <CopilotProvider>
          <OpenCopilotButton />
          <AskClaimButton />
          <RialoCopilotPanel />
        </CopilotProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /ask claim/i }));
    expect(
      await screen.findByText("Claim 77 paid because delay exceeded the threshold."),
    ).toBeInTheDocument();
    expect(screen.getByText("Claim scope")).toBeInTheDocument();
    expect(screen.getByText("ID: claim-77")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open ask rialo/i }));

    expect(screen.getByText("Overview scope")).toBeInTheDocument();
    expect(screen.queryByText("ID: claim-77")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Claim 77 paid because delay exceeded the threshold."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /question/i })).toHaveValue("");

    fireEvent.change(screen.getByRole("textbox", { name: /question/i }), {
      target: { value: "What needs attention right now?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit question/i }));

    await waitFor(() =>
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2),
    );
    const [, secondInit] = vi.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(JSON.parse(String(secondInit?.body))).toEqual({
      question: "What needs attention right now?",
      subject_type: "overview",
    });
  });

  it("ignores stale in-flight answers after resetting to a clean overview", async () => {
    const claimRequest = createDeferred<Response>();
    const overviewRequest = createDeferred<Response>();

    vi.mocked(globalThis.fetch)
      .mockImplementationOnce(() => claimRequest.promise)
      .mockImplementationOnce(() => overviewRequest.promise);

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <CopilotProvider>
          <OpenCopilotButton />
          <AskClaimButton />
          <RialoCopilotPanel />
        </CopilotProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /ask claim/i }));

    expect(screen.getByText("Claim scope")).toBeInTheDocument();
    expect(screen.getByText("ID: claim-77")).toBeInTheDocument();
    expect(screen.getByText("Live answer")).toBeInTheDocument();
    expect(screen.getByText("connecting")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open ask rialo/i }));

    expect(screen.getByText("Overview scope")).toBeInTheDocument();
    expect(screen.queryByText("ID: claim-77")).not.toBeInTheDocument();
    expect(screen.queryByText("Live answer")).not.toBeInTheDocument();
    expect(screen.queryByText("connecting")).not.toBeInTheDocument();

    await act(async () => {
      claimRequest.resolve(
        new Response(
          JSON.stringify({
            status: "ok",
            answer: "Claim 77 paid because delay exceeded the threshold.",
            sources: [],
            suggested_prompts: [],
            confidence: 0.88,
            model: "deepseek-v4-pro",
          }),
          { status: 200 },
        ),
      );
      await claimRequest.promise;
      await Promise.resolve();
    });

    expect(screen.getByText("Overview scope")).toBeInTheDocument();
    expect(screen.queryByText("ID: claim-77")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Claim 77 paid because delay exceeded the threshold."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Live answer")).not.toBeInTheDocument();
    expect(screen.queryByText("connecting")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: /question/i }), {
      target: { value: "What needs attention right now?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit question/i }));

    await waitFor(() =>
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2),
    );

    await act(async () => {
      overviewRequest.resolve(
        new Response(
          JSON.stringify({
            status: "ok",
            answer: "Overview refreshed.",
            sources: [],
            suggested_prompts: [],
            confidence: 0.9,
            model: "deepseek-v4-pro",
          }),
          { status: 200 },
        ),
      );
      await overviewRequest.promise;
      await Promise.resolve();
    });

    expect(await screen.findByText("Overview refreshed.")).toBeInTheDocument();
  });

  it("moves focus into the panel, traps tab, closes on Escape, and restores focus", async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <CopilotProvider>
          <OpenCopilotButton />
          <RialoCopilotPanel />
        </CopilotProvider>
      </MemoryRouter>,
    );

    const launcher = screen.getByRole("button", { name: /open ask rialo/i });
    launcher.focus();

    fireEvent.click(launcher);

    const dialog = screen.getByRole("dialog");
    const closeButton = screen.getByRole("button", { name: /close ask rialo/i });

    await waitFor(() => expect(closeButton).toHaveFocus());

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(dialog).toHaveFocus();

    fireEvent.keyDown(window, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(launcher).toHaveFocus());
  });

  it("does not hijack Shift+Tab from the last focusable control", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          answer: "BA178 is the closest flight to a payout threshold right now.",
          sources: [
            {
              type: "flight",
              id: "BA178-20260614",
              label: "Flight BA178",
              href: "/flights/BA178-20260614",
            },
            {
              type: "claim",
              id: "claim-one",
              label: "Claim claim-one",
              href: "/claims/claim-one/timeline",
            },
          ],
          suggested_prompts: ["Which claim should I inspect next?"],
          confidence: 0.91,
          model: "deepseek-v4-pro",
        }),
        { status: 200 },
      ),
    );

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <CopilotProvider>
          <OpenCopilotButton />
          <RialoCopilotPanel />
        </CopilotProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /open ask rialo/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /question/i }), {
      target: { value: "What needs attention right now?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit question/i }));

    await screen.findByText(
      "BA178 is the closest flight to a payout threshold right now.",
    );

    const dialog = screen.getByRole("dialog");
    const lastFocusableButton = screen.getByRole("button", {
      name: "Flight BA178",
    });
    lastFocusableButton.focus();
    expect(lastFocusableButton).toHaveFocus();

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(dialog).not.toHaveFocus();
    expect(lastFocusableButton).toHaveFocus();
  });
});
