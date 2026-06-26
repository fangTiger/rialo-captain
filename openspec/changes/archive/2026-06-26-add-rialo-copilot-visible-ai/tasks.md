## 1. Backend TDD

- [x] 1.1 Add backend tests for unauthenticated `/copilot/ask`, missing DeepSeek key unavailable state, and successful overview response with mocked provider
- [x] 1.2 Add backend tests for flight, policy, claim, and evidence subject context construction with source citations
- [x] 1.3 Add backend tests proving cross-user policy/claim subjects are rejected before provider invocation
- [x] 1.4 Add backend tests for DeepSeek provider JSON parsing, timeout/error mapping, and no raw provider response leakage

## 2. Backend Implementation

- [x] 2.1 Add DeepSeek V4 configuration to backend settings with `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`, and timeout defaults
- [x] 2.2 Create `backend/copilot` schemas, context builder, provider abstraction, DeepSeek provider, and service orchestration
- [x] 2.3 Add authenticated `POST /copilot/ask` router and include it in `backend/app.py`
- [x] 2.4 Ensure Copilot context uses field allowlists and current-user ownership checks

## 3. Frontend TDD

- [x] 3.1 Add frontend tests for `Ask Rialo` TopNav visibility on protected routes and absence on `/login`
- [x] 3.2 Add frontend tests for Copilot panel loading, answer, sources, suggested prompts, and provider unavailable states
- [x] 3.3 Add frontend tests for Tower `AI Briefing` prompt chips opening Copilot with overview subject
- [x] 3.4 Add frontend tests for FlightDetail, ClaimsFeed, MyHangar, and EvidenceDrawer context prompt chips

## 4. Frontend Implementation

- [x] 4.1 Add Copilot API client, hook, provider, global panel, prompt chips, and source rendering components
- [x] 4.2 Add `Ask Rialo` entry to shell navigation and wire it to the global Copilot panel
- [x] 4.3 Add Tower `AI Briefing` module with prominent AI copy and prompt chips
- [x] 4.4 Add contextual Copilot prompt chips to FlightDetail, ClaimsFeed, MyHangar, and EvidenceDrawer
- [x] 4.5 Polish responsive styling so the AI entry and panel are visible without overlapping existing controls

## 5. Review and Verification

- [x] 5.1 Run OpenSpec status and confirm proposal, design, specs, and tasks are consistent
- [x] 5.2 Run backend tests for Copilot and affected auth/data access behavior
- [x] 5.3 Run frontend tests and production build or equivalent type/build verification
- [x] 5.4 Start local backend/frontend and browser-check dev login plus Ask Rialo unavailable/success states
- [x] 5.5 Send worker diff to reviewer and resolve all high/medium review findings
