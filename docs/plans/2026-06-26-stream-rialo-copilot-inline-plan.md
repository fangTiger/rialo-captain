# Stream Rialo Copilot Inline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build homepage inline streaming Copilot for Tower while keeping DeepSeek context and recommendations small.

**Architecture:** Add a server-side `POST /copilot/ask/stream` SSE endpoint and a shared frontend stream parser. Upgrade `AIBriefing` from prompt launcher into an inline overview composer that streams answers directly on the homepage; keep the existing side panel for deep subject contexts. Cap backend context sample flights and all suggested prompts at 5.

**Tech Stack:** FastAPI, httpx async streaming, Pydantic, React, Vite, Vitest, Testing Library.

---

### Task 1: Backend Streaming + Context Caps

**Files:**
- Modify: `backend/copilot/provider.py`
- Modify: `backend/copilot/service.py`
- Modify: `backend/copilot/routes.py`
- Modify: `backend/copilot/schemas.py`
- Modify: `backend/copilot/context.py`
- Test: `backend/tests/unit/test_copilot_provider.py`
- Test: `backend/tests/unit/test_copilot_service.py`
- Test: `backend/tests/integration/test_copilot_routes.py`

**Step 1: Write failing tests**
- Add provider test that mocked streaming DeepSeek chunks become answer deltas.
- Add route test for `/copilot/ask/stream` event order: `context`, one or more `delta`, optional `suggestions`, `done`.
- Add route test for unauthenticated stream request returning 401.
- Add route test for missing key emitting unavailable/error without calling provider.
- Add context test proving live tower sample flights are capped at 5.
- Add service/route test proving suggested prompts are capped at 5.

**Step 2: Run RED**
- Run backend targeted tests and confirm failures are due to missing stream API or missing caps.

**Step 3: Implement minimal backend**
- Add stream event Pydantic models or typed dicts.
- Add SSE encoder helper with `event: <name>` and JSON `data`.
- Add `DeepSeekProvider.stream()` using `httpx.AsyncClient.stream()` and parse OpenAI-compatible `data:` chunks.
- Add service method yielding safe events.
- Add route `POST /copilot/ask/stream` with same auth and not-found behavior as `/copilot/ask`.
- Extend context builder or service injection so overview includes live tower summary capped at 5.
- Cap suggestions at 5 in both streaming and non-streaming paths.

**Step 4: Run GREEN**
- Run targeted backend tests until green.

### Task 2: Frontend Streaming Parser + Provider

**Files:**
- Modify: `frontend/src/api/copilot.ts`
- Modify: `frontend/src/components/copilot/CopilotProvider.tsx`
- Test: `frontend/src/tests/copilot-panel.test.tsx`
- Test: add or update stream parser tests near existing frontend tests

**Step 1: Write failing tests**
- Test that `askCopilotStream()` parses SSE `context`, `delta`, `done`, and `error`.
- Test provider appends deltas incrementally and finalizes on `done`.
- Test provider aborts stale stream when a new question starts.
- Test provider/panel suggestions never render more than 5.

**Step 2: Run RED**
- Run targeted frontend Copilot tests and confirm expected failures.

**Step 3: Implement minimal frontend stream state**
- Add `askCopilotStream(input, handlers, signal)` or an async iterator API.
- Add robust SSE parser handling chunk boundaries.
- Add streaming state to provider: connection status, stream answer, sources, suggestions capped at 5, final response, abort controller.
- Make existing `ask()` use the stream path with fallback to non-stream if needed.

**Step 4: Run GREEN**
- Run targeted frontend Copilot tests until green.

### Task 3: Homepage Inline AI Briefing

**Files:**
- Modify: `frontend/src/components/copilot/AIBriefing.tsx`
- Modify: `frontend/src/routes/TowerShell.tsx` only if layout props are needed
- Test: `frontend/src/tests/tower-shell.test.tsx`

**Step 1: Write failing tests**
- Test Tower renders an inline AI Briefing composer.
- Test clicking a homepage recommendation streams/asks overview inline and does not call `openPanel`.
- Test default recommendations are capped at 5.
- Test partial answer text appears in the homepage AI Briefing state.

**Step 2: Run RED**
- Run `pnpm --dir frontend vitest run src/tests/tower-shell.test.tsx src/tests/copilot-panel.test.tsx`.

**Step 3: Implement inline UI**
- Convert `AIBriefing` into a compact homepage Copilot composer.
- Include question input, submit button, max 5 recommendation chips, stream status, answer area, live cursor, sources summary, retry/error state.
- Keep width around existing `28rem`; cap answer area height with internal scroll so it does not cover the map.
- Homepage interactions must not open the side panel.

**Step 4: Run GREEN**
- Run targeted frontend tests until green.

### Task 4: Verification

**Commands:**
- `openspec validate stream-rialo-copilot-answers --strict`
- Backend targeted Copilot tests.
- Frontend targeted Copilot/Tower tests.
- `pnpm --dir frontend build`
- Restart local backend/frontend with dev login, mock flights, and runtime DeepSeek key.
- Browser smoke: dev login, Tower map, inline homepage stream, 5 recommendation cap, no-policy wording.

**Reviewer checklist:**
- DeepSeek key stays backend-only.
- No raw provider response or key value leaks in stream errors.
- Homepage answer is inline, not modal.
- Suggestions and sample flights are capped at 5.
- Stream abort prevents stale writes.
- Tests prove RED/GREEN behavior, not just snapshot changes.
