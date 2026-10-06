# plan.md

**Saarthi — web-search fact plan.**

This is a *research* plan, not an engineering plan (that lives in `AGENTS.md`).
Before writing code for each milestone, we verify the risky assumptions below
against current, primary sources. Every item has: a goal, the exact search
queries to run, the sources to trust, the facts to extract, and the decision it
unblocks. Mark each item `TODO` / `DONE` / `N/A` as we go.

Last updated: 2026-10-06.

## How to use this file

1. Work top to bottom by **priority** (P0 blocks milestone 1, P1 blocks 2–4, etc.).
2. For each item, run the queries, open the primary source (official docs / source
   code / specs — not blogspam), and write the finding under **Finding** with a
   date and URL.
3. Record a **Decision** only when the finding changes what we build.
4. Update `DOC.md` with any new canonical link discovered.
5. If a fact is version-specific, pin the version (e.g. Next.js 15.x, Node 22).

Legend — Priority: `P0` = blocks milestone 1, `P1` = blocks 2–4, `P2` = polish.
Status: `TODO` | `WIP` | `DONE` | `N/A`.

---

## Research method & trust hierarchy

- **Tier 1 (authoritative):** official docs, language/framework specs, source
  code on GitHub, RFCs, W3C/TC39, release notes.
- **Tier 2 (strong):** maintainer blog posts, conference talks, well-starred
  reference implementations.
- **Tier 3 (leads only):** Stack Overflow, random blog posts — use to discover
  Tier 1, never cite as fact.
- Always check the **date** and **version** of a source. A 2022 answer about
  Next.js webpack is likely wrong for Turbopack/App Router.
- Prefer **running a spike** over reading when the doc is ambiguous. A spike is
  the strongest fact.

---

## P0 — Blocks milestone 1 (capture one flow → JSON)

### R1. Babel transform: can we wrap *every* function form correctly?

- **Goal:** know exactly which AST node types must be handled and the correct
  wrapping strategy for each, without breaking semantics.
- **Queries:**
  - `babel plugin wrap function body enter exit instrumentation`
  - `babel traverse FunctionDeclaration FunctionExpression ArrowFunctionExpression`
  - `babel types isArrowFunctionExpression async generator function`
  - `babel plugin instrumentation istanbul how it wraps functions`
  - `how to preserve this binding wrapping class method babel`
  - `babel transform async function try finally wrap`
- **Sources:** babeljs.io docs, `istanbuljs/babel-plugin-istanbul` source,
  `babel-handbook`, AST Explorer experiments.
- **Facts to extract:**
  - Full list of function-like node types to handle: `FunctionDeclaration`,
    `FunctionExpression`, `ArrowFunctionExpression`, `ObjectMethod`,
    `ClassMethod`, `ClassPrivateMethod`, and TS variants.
  - How to preserve `this` (arrow vs method), `arguments`, `new.target`,
    recursion, generator `.throw()`, async return values.
  - Correct place to inject `try/finally` so `__exit` always fires on throw.
  - How to handle implicit arrow returns (`() => expr`).
  - Whether a function-size threshold (skip tiny fns) is safe.
- **Decision unblocks:** the shape of `packages/babel`.
- **Finding:** _(empty)_
- **Decision:** _(empty)_
- **Status:** TODO

### R2. Skip `node_modules` and non-app code

- **Goal:** confirm how to reliably restrict the transform to user code only.
- **Queries:**
  - `babel plugin exclude node_modules filename option`
  - `webpack loader exclude node_modules next.js app`
  - `next.js webpack config include app components directories`
- **Facts to extract:** matcher for app dirs, how to detect workspace packages
  vs deps, interaction with pnpm symlinked `node_modules`.
- **Decision unblocks:** coverage boundary (own code vs deps).
- **Finding:** _(empty)_
- **Decision:** _(empty)_
- **Status:** TODO

### R3. Span schema & OTel compatibility

- **Goal:** make our span shape a strict subset/superset of an OTel span so
  export later is free.
- **Queries:**
  - `opentelemetry span data model fields traceId spanId parentSpanId`
  - `otel span status codes status message`
  - `otel semantic conventions function`
  - `chrome trace event format duration event ph X`
- **Sources:** OTel spec repo, OTel traces concept docs, Chrome trace format
  docs (for viztracer-style compatibility).
- **Facts to extract:** required/optional fields, ID formats, timestamp units
  (ns vs ms), status enum values, how to encode errors on a span.
- **Decision unblocks:** `packages/core` types.
- **Finding:** _(empty)_
- **Decision:** _(empty)_
- **Status:** TODO

### R4. Zero-config dev wrapper mechanics

- **Goal:** confirm `npx saarthi dev` can wrap `next dev` and inject both a
  server require-hook and a client webpack loader with no user edits.
- **Queries:**
  - `next dev custom webpack config from cli programmatically`
  - `next.js instrumentation.ts register hook server`
  - `NODE_OPTIONS --require hook node module transform`
  - `pirates addHook node require hook`
  - `next.js turbopack custom loader support`
- **Facts to extract:** whether App Router dev uses webpack or Turbopack by
  default in the target Next version; whether Turbopack supports custom loaders;
  how `instrumentation.ts` loads; how `NODE_OPTIONS` interacts with `next dev`.
- **Decision unblocks:** `packages/cli` + `packages/next` integration path.
- **Finding:** _(empty)_
- **Decision:** _(empty)_
- **Status:** TODO

---

## P1 — Blocks milestones 2–4 (viewer, sidebar, async)

### R5. Async parent-child correctness (server)

- **Goal:** guarantee a child span keeps its parent across `await`, timers,
  callbacks, promises, and streams.
- **Queries:**
  - `AsyncLocalStorage preserve context across await callbacks`
  - `node async_hooks AsyncResource bind callback`
  - `AsyncLocalStorage performance overhead`
  - `AsyncLocalStorage next.js server actions`
  - `why AsyncLocalStorage context lost promise then`
- **Sources:** Node docs, Node source, Next.js docs, OTel JS context manager
  implementation (`AsyncLocalStorageContextManager`).
- **Facts to extract:** the correct store shape (a stack), where to `run()`,
  known leak/loss cases, overhead numbers, how OTel JS does it (copy their model).
- **Decision unblocks:** capture correctness (the #1 risk).
- **Finding:** _(empty)_
- **Decision:** _(empty)_
- **Status:** TODO

### R6. Async correctness on the client / React

- **Goal:** understand what breaks in the browser and the cheapest reliable fix.
- **Queries:**
  - `zone.js react async context propagation`
  - `AsyncContext browser TC39 status`
  - `react render effects async parent context tracing`
  - `patch promise prototype then trace context browser`
  - `opentelemetry browser instrumentation react`
- **Facts to extract:** whether Zone.js is worth the weight, TC39 AsyncContext
  browser availability, OTel browser SDK approach, React concurrent render
  implications.
- **Decision unblocks:** client coverage strategy.
- **Finding:** _(empty)_
- **Decision:** _(empty)_
- **Status:** TODO

### R7. React coverage specifics

- **Goal:** correctly instrument components, hooks, effects, RSC, server actions.
- **Queries:**
  - `react server components server action execution context next.js`
  - `instrument react component render without breaking rules of hooks`
  - `next.js server action streaming response tracing`
  - `react strict mode double render dev instrumentation`
  - `use client vs server component boundaries`
- **Facts to extract:** where client vs server code runs, how to avoid breaking
  Rules of Hooks, how Strict Mode double-invocation affects spans, how server
  actions stream and return.
- **Decision unblocks:** which node types/where to inject on React.
- **Finding:** _(empty)_
- **Decision:** _(empty)_
- **Status:** TODO

### R8. Live streaming transport

- **Goal:** pick SSE vs WebSocket and prove the dev-server side works.
- **Queries:**
  - `server sent events vs websocket when to use`
  - `next.js route handler server sent events stream`
  - `node res.write sse flush next dev`
  - `sse reconnect event id last-event-id`
- **Facts to extract:** buffering/proxy issues in Next dev, reconnect semantics,
  message size limits, batching interval best practice.
- **Decision unblocks:** transport choice in `packages/next` + `packages/viewer`.
- **Finding:** _(empty)_
- **Decision:** _(empty)_
- **Status:** TODO

### R9. Viewer rendering performance

- **Goal:** ensure the race pane and flow pane stay usable with thousands of
  spans.
- **Queries:**
  - `react flow performance thousands of nodes`
  - `react flow large graph optimization onlyRenderVisibleElements`
  - `d3 waterfall chart large dataset performance`
  - `canvas vs svg rendering many rectangles performance`
- **Facts to extract:** practical node limits for React Flow, virtualization
  options, when to switch waterfall rendering to canvas, incremental update
  strategy for streaming.
- **Decision unblocks:** `packages/viewer` rendering approach.
- **Finding:** _(empty)_
- **Decision:** _(empty)_
- **Status:** TODO

---

## P2 — Polish, packaging, and validation

### R10. Instrumentation overhead measurement

- **Goal:** quantify slowdown and set a defensible mitigation default.
- **Queries:**
  - `javascript function instrumentation overhead benchmark`
  - `istanbul instrumentation overhead percentage`
  - `nyc performance overhead instrumentation`
- **Facts to extract:** published overhead numbers, what dominates (call count
  vs function size), effective thresholds.
- **Decision unblocks:** default thresholds + `--include-deps` framing.
- **Finding:** _(empty)_
- **Decision:** _(empty)_
- **Status:** TODO

### R11. Distribution & packaging

- **Goal:** ship `npx saarthi dev` and `@saarthi/next` cleanly.
- **Queries:**
  - `pnpm workspace publish multiple packages`
  - `npx package bin executable typescript build`
  - `changesets monorepo release`
  - `tsup build node cli esm cjs`
- **Facts to extract:** bin wiring, ESM/CJS dual publishing for a Next plugin,
  versioning/release flow.
- **Decision unblocks:** repo tooling in `AGENTS.md`.
- **Finding:** _(empty)_
- **Decision:** _(empty)_
- **Status:** TODO

### R12. Prior-art deep dive (learn, don't rebuild)

- **Goal:** extract concrete implementation lessons and avoid re-inventing.
- **Queries:**
  - `viztracer architecture how it traces function entry exit`
  - `speedscope file format import`
  - `opentelemetry js context manager AsyncLocalStorage implementation`
  - `istanbul babel plugin instrumentation source code`
  - `opentelemetry instrumentation js require hook source`
- **Facts to extract:** how viztracer captures every call cheaply, OTel JS
  context manager internals, istanbul's wrap pattern, speedscope import format.
- **Decision unblocks:** reuse decisions across `babel`, `core`, `viewer`.
- **Finding:** _(empty)_
- **Decision:** _(empty)_
- **Status:** TODO

### R13. Legal / privacy (dev-only)

- **Goal:** confirm dev-only capture carries no user-data obligations.
- **Queries:**
  - `opentelemetry pii span attributes guidance`
  - `gdpr local only developer tool no data transmission`
- **Facts to extract:** risks if args are captured; whether to redact args by
  default.
- **Decision unblocks:** whether span captures args/values at all in v1.
- **Finding:** _(empty)_
- **Decision:** _(empty)_
- **Status:** TODO

---

## Open questions to resolve by search (parking lot)

- Does App Router dev default to Turbopack, and can a custom loader run under it?
- Can `instrumentation.ts` reliably install an `AsyncLocalStorage` context for
  server actions, or do we need a `--require` hook?
- What is the cheapest way to detect "waiting/blocked" spans (await on I/O)
  without a full promise wrapper?
- How does Next.js Strict Mode affect span counts in dev?
- What's the practical React Flow node ceiling before it janks?

## Spike checklist (run code, not just read)

- [ ] Wrap one real Next.js route with the Babel transform; confirm no behavior
      change and correct JSON out.
- [ ] Reproduce parent-child loss across `await` with a naive stack; then fix
      with `AsyncLocalStorage` and re-test.
- [ ] Stream 1,000 synthetic spans into the viewer; measure jank.
- [ ] Run `npx`-style wrapper against a scratch Next app; confirm zero edits.

---

# Part 2 — Engineering plan

Part 1 above is *research* (what we must verify). This part is *execution* (what
we build, in what order, and how we know it's done). It expands the milestone
list in `AGENTS.md` into concrete tasks with interfaces and acceptance criteria.

## Architecture at a glance

```
 user's Next.js app
        │  (Babel/Vite/webpack transform, dev only)
        ▼
 ┌───────────────┐   __enter/__exit calls   ┌──────────────┐
 │ instrumented  │ ───────────────────────▶ │ runtime      │
 │ app code      │                          │ collector    │
 └───────────────┘                          │ (core)       │
                                            └──────┬───────┘
                                                   │ spans (batched ~50-100ms)
                                                   ▼
                                          ┌──────────────────┐
                                          │ transport        │
                                          │ SSE/WebSocket    │
                                          └────────┬─────────┘
                                                   │
                                                   ▼
                                          ┌──────────────────┐
                                          │ viewer (React)   │
                                          │ sidebar + race   │
                                          └──────────────────┘
```

## Package responsibilities

| Package | Owns | Must not |
|---|---|---|
| `core` | span types, trace builder, ID gen, JSON schema, `__enter/__exit` runtime | know about Babel or React |
| `babel` | AST transform only | emit or transport spans |
| `next` | wiring: webpack loader, server require-hook, dev endpoint, transport | contain trace logic |
| `viewer` | rendering only, consumes the span schema | instrument anything |
| `cli` | `saarthi dev`, process wiring, opens report | duplicate `next` logic |

## Core interfaces (draft — refine after research)

```ts
// packages/core
type SpanStatus = "running" | "waiting" | "done" | "failed";

interface Span {
  id: string;
  parentId: string | null;
  name: string;
  file: string;
  line: number;
  start: number;        // ms offset from trace start
  end: number | null;   // null while running
  selfMs: number | null;
  status: SpanStatus;
  calls: number;
  error: { name: string; message: string; stack?: string; caught: boolean } | null;
  blockedOn: string | null;
}

interface Trace {
  traceId: string;
  root: string;
  totalMs: number;
  spans: Span[];
}

// runtime injected into user code
function __enter(id: string, name: string, file: string, line: number): void;
function __exit(id: string, error?: unknown): void;
```

## Milestone 1 — capture one flow → JSON

**Goal:** prove capture end-to-end server-side, no UI.

Tasks:
1. `core`: span/trace types, `TraceBuilder`, monotonic clock, ID generation.
2. `babel`: transform handling every function-like node (see R1), injecting
   `try/finally` so `__exit` always fires; skip non-app code (R2).
3. `next`: server-side `--require` hook that transforms app modules on load.
4. `cli`: `saarthi dev` wrapper that sets the hook and runs `next dev`.
5. Dump a `trace.json` per request to `.saarthi/`.

Acceptance criteria:
- A real Next.js route with nested function calls produces a valid `trace.json`.
- No behavior change: app output identical with tracing on/off.
- Throwing function is marked `failed` and re-thrown.

## Milestone 2 — waterfall viewer + live streaming

**Goal:** see the race build itself in the browser.

Tasks:
1. `next`: dev-only endpoint streaming spans over SSE/WebSocket, batched 50–100ms
   (transport decision from R8).
2. `viewer`: waterfall renderer — x = start offset, width = duration, lanes by
   depth; playhead 0→100%; status colors.
3. Incremental append + re-parent on arrival by `traceId`/`parentId`.
4. `cli`: open the report UI automatically.

Acceptance criteria:
- Interacting with the app makes boxes appear, grow, and complete live.
- Out-of-order spans re-parent correctly; no permanent orphans.
- 1,000 spans stay interactive (perf check from R9).

## Milestone 3 — sidebar + sync + filters

**Goal:** the left timing index.

Tasks:
1. `viewer`: sidebar rows (status icon, total ms, self ms, calls, `file:line`).
2. Sort by total/self time; filters (failed / waiting / slow / search).
3. Bidirectional click-sync with the race pane.
4. Bottleneck computation ("X = N% of this request").

Acceptance criteria:
- Clicking a row highlights + scrolls the span, and vice versa.
- `selfMs` ranking correctly ignores time spent in children.

## Milestone 4 — async correctness + React coverage

**Goal:** make the flow *true*. Do not skip.

Tasks:
1. `core`: `AsyncLocalStorage`-backed context manager; store is a stack.
2. `next`: install context per request; cover server actions + RSC.
3. client: promise-boundary patching; handle Strict Mode double-render (R7).
4. Fix parent-child loss discovered by the spike (R5/R6).

Acceptance criteria:
- Child spans stay attached to their true parent across `await`, timers,
  callbacks, and promises.
- Same on the client for components/hooks/effects.
- A deliberately reordered async flow renders with correct nesting.

## Milestone 5 — flow view + report + polish

**Goal:** ship the shareable artifact and the graph toggle.

Tasks:
1. `viewer`: React Flow call-graph mode; edges labeled with time + status.
2. Bottleneck banner finalized.
3. Self-contained `report.html` export (inline data + viewer).
4. `cli`: `saarthi report` to open a saved trace.

Acceptance criteria:
- Toggle between race and flow on the same trace.
- `report.html` opens offline with no server.

## Testing strategy

- **Unit:** `babel` transform (snapshot AST in/out), `core` trace builder,
  self-time math, re-parenting reducer.
- **Integration:** run the transform against fixture apps; assert JSON shape.
- **E2E:** scripted Next.js app + a headless browser driving the viewer.
- **Perf:** synthetic 1k/10k span traces for the viewer; overhead benchmark for
  the transform.
- Framework: Vitest; fixtures committed under `packages/*/test/fixtures`.

## Repo & tooling setup

- pnpm workspaces monorepo (layout in `AGENTS.md`).
- TypeScript project references or per-package `tsconfig`.
- `tsup` for building publishable packages; Vite for the viewer.
- Changesets for versioning; CI runs typecheck + test + lint.
- Dev scripts at root: `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm lint`.

## Definition of done (per milestone)

1. Research items it depends on are `DONE` with findings recorded.
2. Acceptance criteria above all pass.
3. Tests added and green; typecheck + lint clean.
4. No behavior change to the host app; prod builds contain zero instrumentation.
5. `AGENTS.md` / `DOC.md` updated if decisions changed.

## Cross-cutting guardrails

- Instrumentation must be compile-time gated (dev only) — verify prod bundle has
  no `__enter`/`__exit` and no runtime import.
- Never capture function arguments/return values in v1 unless R13 says it's safe.
- Keep the wire format OTel-shaped at all times.

---

## Change log

- 2026-10-06 — file created; P0–P2 research items seeded from `AGENTS.md` risks.
- 2026-10-06 — added Part 2: engineering plan (architecture, interfaces,
  milestones, testing, DoD).
