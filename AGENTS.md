# AGENTS.md

Project context and conventions for AI agents working in this repo.

## What this is

**Sarathi** — a zero-config, dev-only profiling/tracing tool for vibe-coded
Next.js/React apps. It auto-instruments every function in the user's own code,
streams a live trace, and renders it as an interactive race/waterfall plus a
call-graph so users can see:

> **Name:** *Sarathi* (सारथि) is Sanskrit for "charioteer." In the Bhagavad Gita,
> Krishna is Arjuna's sarathi — the one who steers him through the battlefield
> when he is lost. The tool is the same: a guide that shows you where your code
> is going and where it stumbles. CLI: `npx sarathi dev`.

- which function ran after which (call flow)
- how long each function took (speed / lag)
- which function failed, and whether the error was caught or propagated
- which functions are blocked (`waiting` on I/O / DB / network / `await`)

The core pitch: the user installs one command, uses their app, and watches the
flowchart build itself in real time. No SDK calls, no manual instrumentation.

## Locked product decisions

- **Target:** Next.js / React (App Router first).
- **Primary view:** timeline / race (waterfall). Flow/call-graph is a toggle.
- **Coverage:** 100% of the user's own code (functions, methods, arrow fns,
  components, hooks, route handlers, server actions). `node_modules` / React
  internals render as opaque boundary blocks. Opt-in `--include-deps` for full.
- **Environment:** dev-only for v1. Production is a later phase (needs sampling,
  privacy controls, and a collector backend).
- **Install:** `npx sarathi dev` (zero config). Persistent: `npm i -D
  @sarathi/next` + `withSarathi(nextConfig)`.

## What each span captures

Every instrumented call produces a span with:

| Dimension | Fields |
|---|---|
| Identity | `id`, `name`, `file`, `line`, `parentId`, call count |
| Timing | `start`, `end` (offsets from trace start), `totalMs`, `selfMs` |
| Status | `running` \| `waiting` \| `done` \| `failed` |
| Errors | error `name`, `message`, stack, whether caught or propagated |
| Blocking | `blockedOn` label when status is `waiting` |

`selfMs` (time excluding children) is the primary lag signal — a fast wrapper
around a slow child must not be falsely blamed.

### Span schema (OTel-compatible)

```json
{
  "traceId": "…",
  "root": "s1",
  "totalMs": 842,
  "spans": [
    {
      "id": "s1",
      "parentId": null,
      "name": "handleSignup",
      "file": "app/actions.ts",
      "line": 12,
      "start": 0,
      "end": 842,
      "selfMs": 40,
      "status": "done",
      "calls": 1,
      "error": null,
      "blockedOn": null
    }
  ]
}
```

Deliberately shaped like an OpenTelemetry span so we can export to
Jaeger/Tempo later without a migration.

## UI layout

Two panes:

**Left — timing sidebar**
- One row per function, sortable by total time or self-time.
- Columns: status icon, total ms, self ms, call count, `file:line`.
- Filters: only failed / only waiting / only slow / search by name.
- Click a row to highlight + scroll to that span in the right pane (bidirectional).

**Right — race pane**
- **Waterfall mode:** each function is a box; x-position = start offset, width =
  duration, nested by call depth. A playhead scrubs 0 -> 100%.
- **Flow mode:** React Flow call-graph; nodes = functions, edges = calls,
  labeled with time and status.
- Color = status: `done` green, `running` blue, `waiting` grey, `failed` red.
- Auto bottleneck banner: e.g. "hashPassword = 76% of this request".

## Real-time behavior

- Dev server streams spans over SSE/WebSocket as the request executes.
- A box appears on `__enter` (`running`), resizes on `__exit` (`done`/`failed`),
  and the playhead advances.
- Spans are batched and flushed every ~50-100ms to keep dev overhead low. It is
  near-real-time, not frame-perfect.
- Client and server spans arrive on separate streams. A child may arrive before
  its parent; re-parent by `traceId`/`parentId` on arrival so the graph
  self-corrects instead of showing orphans.

## Repo layout (pnpm monorepo)

```
packages/
  core/     span model + trace builder + JSON schema
  babel/    AST transform: wraps every function with __enter/__exit
  next/     withSarathi() webpack plugin + server --require hook
  viewer/   React UI: sidebar + waterfall (D3) + flow (React Flow)
  cli/      `sarathi dev` wrapper; opens report
```

## How capture works

- Babel AST transform injects `__enter(id, name, file, line)` / `__exit(id, error?)`
  around every function body in app code (skip `node_modules`).
- `__enter`/`__exit` push onto a stack, giving correct parent-child nesting.
- Async context: use Node's `AsyncLocalStorage` on the server to preserve parent
  across `await` / callbacks. On the client, patch promise boundaries.
- Errors: if a wrapped function throws, mark it `failed`, record the error, and
  re-throw so app behavior is unchanged. If a caller catches it, the caller stays
  `done` while the child stays `failed` — showing where the failure was absorbed.
- Only active when `SARATHI=1` / dev mode. Prod is never touched.

## Build order / milestones

1. `core` schema + `babel` transform. Capture a single click flow server-side,
   dump JSON.
2. Waterfall viewer (right pane) with statuses, including **live streaming**
   (SSE/WebSocket). Prove capture -> render end-to-end.
3. Left sidebar + click-to-sync + sorting/filters.
4. Async context correctness (`AsyncLocalStorage`) + client/React coverage.
5. Flow view + bottleneck detection + shareable self-contained `report.html`.

## Known risks

- **Async parent-child correctness** is make-or-break. If it breaks, the
  flowchart lies. Do not polish UI before milestone 4.
- **Instrumentation overhead.** Wrapping every function can 5-20x dev-server
  slowdown. Mitigate: app code only, batching, and a function-size threshold.
- **Trace noise.** Full dep instrumentation produces unusable traces; keep it
  opt-in.

## Conventions

- Language: TypeScript throughout.
- Package manager: pnpm (workspace monorepo).
- Do not add comments unless asked.
- Keep prod builds completely free of instrumentation code (compile-time gate).
- Prefer the OpenTelemetry span shape for anything on the wire.

## Debug logging

Every function should carry at least one debug log so we can trace our own flow
while building Sarathi and see exactly where something breaks.

- Use the shared `debug(scope, ...args)` helper — never bare `console.log` in a
  shipped code path. It is gated behind `SARATHI_DEBUG=1`, so normal runs stay
  quiet and overhead-free.
- Log at entry with the meaningful inputs, and at exit with the outcome
  (status/result/error). Add more logs inside a function when debugging a
  specific problem — one or many, as needed.
- Scope names match the package: `debug("core", …)`, `debug("babel", …)`,
  `debug("next", …)`, `debug("cli", …)`, `debug("viewer", …)`.
- Enable during development: `SARATHI_DEBUG=1 pnpm test` or
  `SARATHI_DEBUG=1 npx sarathi dev`.

## Not yet decided

- Error grouping / repeat-count (dedupe identical errors).
- Whether to ship a backend collector for the production phase.
