## 1. Backend RED Tests

- [x] 1.1 Add Copilot stream route tests for unauthenticated requests, missing DeepSeek key, successful SSE event order, and provider error events
- [x] 1.2 Add Copilot service/provider tests for streaming DeepSeek chunks into `delta` and `done` events without requiring partial JSON parsing
- [x] 1.3 Add overview context tests proving live tower snapshot is included when cache has flights and sample flights are capped at 5
- [x] 1.4 Add overview context tests proving a user with no policies does not receive a “no flights” context when live flights exist

## 2. Backend Implementation

- [x] 2.1 Add typed Copilot stream event schemas and SSE encoding helpers
- [x] 2.2 Add `DeepSeekProvider.stream()` using DeepSeek V4 streaming chat completions with timeout and safe error mapping
- [x] 2.3 Extend `CopilotContextBuilder` with an injectable live tower summary provider backed by `FlightCache`, capped at 5 sample flights
- [x] 2.4 Add `POST /copilot/ask/stream` route with JWT cookie auth, context event, delta events, suggestions event, done event, and error event
- [x] 2.5 Cap backend suggested prompts at 5 for both stream and non-stream responses
- [x] 2.6 Keep `POST /copilot/ask` behavior compatible and reuse shared context/safety logic where practical

## 3. Frontend RED Tests

- [x] 3.1 Add API/parser tests for reading SSE events from a streaming `fetch()` response
- [x] 3.2 Add CopilotProvider tests proving delta events render incrementally and done events finalize the answer
- [x] 3.3 Add CopilotProvider tests proving close/new question aborts the current stream and stale events do not overwrite newer state
- [x] 3.4 Add homepage AI Briefing tests proving overview questions stream inline without opening the Copilot side panel
- [x] 3.5 Add Copilot panel tests for connection state, live cursor, partial answer retention, sources, suggestions capped at 5, and error recovery
- [x] 3.6 Add homepage AI Briefing tests proving collapse hides inline content without triggering `ask`, `stop`, or `openPanel`, and expand restores the current state
- [x] 3.7 Update TopNav and Copilot panel tests for no global overview launcher and inline live transcript streaming

## 4. Frontend Implementation

- [x] 4.1 Add `askCopilotStream()` and reusable SSE parser in `frontend/src/api/copilot.ts`
- [x] 4.2 Update `CopilotProvider` state model for streaming answer text, connection status, abort controller, sources, suggestions, and final response
- [x] 4.3 Update `AIBriefing` into an inline homepage Copilot composer with answer stream, live cursor, answer-matched `Evidence used` shown only after a successful final answer, retry state, and at most 5 recommendations
- [x] 4.4 Update `RialoCopilotPanel` to show streaming text immediately, a live cursor, connection status, answer-matched `Evidence used` shown only after a successful final answer, and recoverable errors
- [x] 4.5 Ensure existing prompt chips and context launchers use the streaming path while keeping non-stream fallback available
- [x] 4.6 Update Copilot UI copy to English-only and replace fixed `Sources` lists with answer-matched `Evidence used` chips/cards capped at 3 items
- [x] 4.7 Add an AI Briefing collapse/expand control that only changes homepage visibility and preserves inline Copilot state
- [x] 4.8 Remove the TopNav global overview launcher and restyle `RialoCopilotPanel` as a lightweight live transcript with inline status and cursor

## 5. Verification

- [x] 5.1 Run `openspec validate stream-rialo-copilot-answers --strict`
- [x] 5.2 Run targeted backend Copilot and flight tests
- [x] 5.3 Run targeted frontend Copilot tests
- [x] 5.4 Run frontend production build
- [x] 5.5 Restart local backend/frontend with dev login, mock live flights, and DeepSeek runtime key
- [x] 5.6 Browser-smoke dev login, Tower live map, homepage inline Copilot overview streaming, 5 recommendation cap, and no-policy live flights wording
