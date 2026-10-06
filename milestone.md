# milestone.md

Execution milestones for **Saarthi**. This file divides the engineering plan
(`plan.md` Part 2) into shippable phases.

**Rule for every milestone:** done means an **end-to-end test proves the intent**
of the feature — a real app is driven, a real trace is produced, and we assert
that the output means what the feature claims it means. Lint/typecheck/unit tests
are required but are *not* sufficient to close a milestone. If we can't write a
test that would fail when the feature silently lies, the milestone isn't real.

## Shared E2E harness

One fixture app is reused and grown across milestones:

```
examples/todo-app/          # a real Next.js App Router app (the "host app")
  app/
    page.tsx                # client UI: Sign up, Add todo, Fail demo
    actions.ts              # server actions: handleSignup, addTodo, boom
    api/hello/route.ts      # route handler
  lib/
    auth.ts                 # hashPassword (slow), validate, createSession
    db.ts                   # insert (slow), findUser, failingQuery
```

- The host app is **never** edited by the developer to use Saarthi (that's the
  zero-config promise) — all wiring is injected by the tool.
- E2E driver: Playwright (headless browser) + Node to run `saarthi dev` and
  inspect emitted artifacts.
- Assertions run against: the streamed spans the viewer receives, and/or
  `.saarthi/trace-*.json`.
- A test must assert **structure and meaning** (who called whom, timing order,
  status), not just "a file exists."

Test command shape: `pnpm --filter e2e test -- milestone-<n>`.

### Debug logging (all milestones)

Every function we write carries at least one `debug(scope, …)` log (gated by
`SAARTHI_DEBUG=1`), so when an E2E assertion fails we can see the exact call path
and state that produced it. A failing E2E run should be reproducible with:

```
SAARTHI_DEBUG=1 pnpm --filter e2e test -- milestone-<n>
```

and the debug output should be enough to localize the failure without a
debugger. If it isn't, that's a signal to add more logs — not to guess.

---

## Milestone 1 — Capture one flow to JSON

**Intent:** prove that Saarthi can auto-instrument an untouched Next.js app and
produce a truthful nested trace of one request, server-side, with no UI.

**Built:** `core` span/trace model, `babel` transform, `next` server require-hook,
`cli` `saarthi dev`, JSON dump to `.saarthi/`.

### E2E workflow

1. Start the fixture app via `npx saarthi dev` (no app edits).
2. Trigger the `handleSignup` server action with a known input.
3. Wait for the trace artifact to be written.
4. Load and inspect the JSON.

### Intent assertions

- `handleSignup` is the root span; `validate` → `hashPassword` → `createSession`
  → `db.insert` appear as **nested descendants in call order** (parentId chain
  matches actual source call order).
- `hashPassword` is marked `waiting` with a non-null `blockedOn` (it awaits the
  slow hash), while its parent stays `running`/`done`.
- Timing sanity: each child's `[start,end]` lies inside its parent's range.
- `selfMs` for `handleSignup` is much smaller than `totalMs` (it's a wrapper).
- **Failure intent:** trigger the `boom` action → that span is `failed` with
  error `name`/`message`; the caller that catches it stays `done`. The host app's
  HTTP response is unchanged versus tracing off.

### Must fail if

- Any span is orphaned or nested under the wrong parent.
- `__exit` doesn't fire on throw (span stuck `running`).
- Running with tracing on changes the app's response body/status.

**Exit criteria:** all assertions green on a clean `npx` run; prod build of the
host app contains zero `__enter`/`__exit` references.

---

## Milestone 2 — Waterfall viewer + live streaming

**Intent:** prove the user can watch the flowchart build itself in real time and
that the rendered geometry is faithful to the trace.

**Built:** dev SSE/WebSocket endpoint, batched flush, waterfall renderer,
incremental append + re-parent on arrival.

### E2E workflow

1. Open the viewer at the report URL.
2. Trigger `handleSignup`.
3. Drive a browser and observe boxes appear/grow/complete **while the request
   runs** (poll DOM during execution, don't wait for completion).
4. After completion, compare rendered boxes to the trace JSON.

### Intent assertions

- A box appears with status `running` **before** the request finishes; it resizes
  on completion (capture an intermediate snapshot).
- Rendered x-position and width match each span's `start`/`duration` within a
  tolerance; depth lanes match nesting.
- Status colors are correct: `waiting` grey on `hashPassword`, `failed` red on
  `boom`, `done` green.
- **Out-of-order intent:** inject a synthetic child that arrives before its
  parent → it re-parents with no permanent orphan.
- Playhead advances 0→100% over the trace duration.

### Must fail if

- Any box is drawn at the wrong time/position (viewer lies vs data).
- Streaming only works after the request completes (not real-time).
- Re-parenting leaves an orphan or duplicates a span.

**Exit criteria:** live assertions pass; 1,000-span synthetic trace stays
interactive (frame budget under threshold).

---

## Milestone 3 — Timing sidebar + sync + filters

**Intent:** prove the left pane accurately ranks *where the app lags* and stays
in sync with the race.

**Built:** sidebar rows, sort by total/self time, filters, bidirectional click
sync, bottleneck banner.

### E2E workflow

1. Produce the `handleSignup` trace.
2. Sort sidebar by self-time, then by total-time.
3. Click `hashPassword`; then click a race box and check the sidebar.
4. Apply each filter; type a search term.

### Intent assertions

- Self-time sort ranks the genuinely lagging function first — **not** the
  wrapper. Assert the wrapper (`handleSignup`) is not #1 by self-time while
  `hashPassword` is.
- Clicking a sidebar row highlights **and scrolls to** the matching race box;
  clicking a race box highlights the matching sidebar row (bidirectional).
- Filters: `failed` shows only the failed span; `waiting` shows only `waiting`;
  `slow` respects the threshold; search matches by name.
- Bottleneck banner states the correct function and a percentage that matches
  computed `selfMs / totalMs` (within rounding).

### Must fail if

- A fast wrapper is blamed as the bottleneck.
- Sync is one-directional or highlights the wrong span.
- Filter leaks spans it should exclude.

**Exit criteria:** all sync/sort/filter assertions pass against a trace with at
least one wrapper, one slow leaf, and one failure.

---

## Milestone 4a — Async correctness (server) — DONE

**Intent:** prove the flowchart is *true* across pauses — the #1 risk. A wrong
flow is worse than no tool.

**Built:** immutable async context via Node `AsyncLocalStorage`.
- The Babel transform now wraps each function body:
  `return __saarthi_run(name, file, line, <async?>() => { …body… })`.
- `runInSpan()` reads the parent from the current async context, enters the span,
  and runs the body inside `storage.run(spanId, …)`, exiting on sync return or
  when the returned promise settles. The parent is immutable per async context,
  so concurrent flows cannot contaminate each other.
- Generators are skipped (documented gap); functions where a `var` would shadow
  a parameter are skipped to preserve semantics.

### E2E workflow

1. Run `server-concurrent.js`: two flows via `Promise.all` that pause on timers
   and resume out of order, plus timer and microtask boundaries.
2. Inspect the trace.

### Intent assertions (all covered by tests)

- Sync nesting, sequential `await`, timer boundary, microtask boundary.
- Concurrent flows (`Promise.all`) with no cross-talk; each child under its own
  flow; parallel fan-out children under the same flow.
- A callee's context does **not** leak into the caller after it returns.
- Async throw → span `failed` + rethrow; a promise-returning sync function keeps
  its span open until the promise settles.
- No orphans under interleaving; every span closed.

### Must fail if

- A resumed child attaches to the wrong parent or to none.
- Concurrent flows contaminate each other's context.
- A callee's context leaks into the caller.

**Exit criteria:** met — `packages/core/src/context.test.ts` (9 cases),
`packages/babel/src/plugin.test.ts` (10 cases), and
`packages/e2e/src/milestone-4.test.ts` (concurrent real trace).

---

## Milestone 4b — Client / React coverage (Next bundler) — TODO

**Intent:** extend the same truth to the browser: client components, hooks,
effects, Strict Mode, and a connected client↔server-action tree.

**Built (planned):** a Next webpack/Turbopack loader that runs the same Babel
transform on client code; a browser context shim (promise-boundary patching,
since `AsyncLocalStorage` is Node-only); Strict Mode double-invocation handling;
a shared `traceId` propagated to the server so client and server spans merge.

### E2E workflow

1. Load the page; trigger a client component + `useEffect` + custom hook flow.
2. Inspect client spans merged into the same trace.

### Intent assertions

- Component render, hook, and effect spans nest correctly under the interaction.
- Strict Mode double-invocation does not misleadingly double-count.
- A client→server-action→back round trip shows one connected tree.

### Must fail if

- Client and server produce disconnected trees for one interaction.
- The browser shim mis-parents concurrent client promises.

**Exit criteria:** client/server E2E pass; one connected tree per interaction.

---

## Milestone 5 — Flow view + shareable report

**Intent:** prove the call-graph view and the offline report convey the same
truth as the live race view, and that the report is self-contained.

**Built:** React Flow flow mode, final bottleneck banner, `report.html` export,
`saarthi report`.

### E2E workflow

1. Produce a trace; toggle race ↔ flow.
2. Export `report.html`; open it in a browser **with no dev server running**.

### Intent assertions

- Flow-mode nodes = functions, edges = calls, edge labels show time + status;
  the graph topology matches the trace's parent-child edges exactly.
- Toggling views keeps the same trace and the same bottleneck.
- `report.html` opens offline and renders identical data to the live view.
- `saarthi report <file>` opens a saved trace correctly.

### Must fail if

- Flow edges disagree with the trace (extra/missing/wrong direction).
- Report needs network or a running server.
- Exported report data differs from the live trace.

**Exit criteria:** offline report matches live view; topology assertions pass.

---

## Milestone sign-off template

For each milestone, record in this file (or PR description):

```
Milestone: <n> — <name>
E2E test: pnpm --filter e2e test -- milestone-<n>
Result: PASS / FAIL
Intent proven: <one sentence — what lie would this test have caught?>
Artifacts: <trace.json / screenshots / report.html>
Notes:
```

## Change log

- 2026-10-06 — file created; 5 milestones with E2E intent tests + shared harness.
