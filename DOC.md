# DOC.md

Reference links for building **Sarathi**. Canonical/stable documentation only.
Last verified: 2026-10-06.

> Convention: prefer the official docs root when a deep link may move. When a
> specific API page is listed, it is the source of truth for that feature.

## Core framework — Next.js / React

- Next.js docs — https://nextjs.org/docs
- Next.js `next.config.js` reference — https://nextjs.org/docs/app/api-reference/config/next-config-js
- Next.js custom webpack config — https://nextjs.org/docs/app/api-reference/config/next-config-js/webpack
- Next.js instrumentation hook — https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
- Next.js server actions — https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- React docs — https://react.dev
- React hooks reference — https://react.dev/reference/react/hooks

## AST instrumentation — Babel

- Babel docs — https://babeljs.io/docs
- Babel plugin handbook — https://github.com/jamiebuilds/babel-handbook
- `@babel/parser` — https://babeljs.io/docs/babel-parser
- `@babel/traverse` — https://babeljs.io/docs/babel-traverse
- `@babel/types` — https://babeljs.io/docs/babel-types
- `@babel/generator` — https://babeljs.io/docs/babel-generator
- `babel-plugin-transform` write guide — https://babeljs.io/docs/plugins#plugin-development
- AST Explorer (inspect real ASTs) — https://astexplorer.net
- SWC (Next.js default compiler; alternative transform path) — https://swc.rs/docs

## Async context correctness

- Node `AsyncLocalStorage` — https://nodejs.org/api/async_context.html
- Node `async_hooks` — https://nodejs.org/api/async_hooks.html
- Node `AsyncResource` — https://nodejs.org/api/async_context.html#class-asyncresource
- TC39 Async Context proposal (future direction) — https://github.com/tc39/proposal-async-context

## Observability / span model

- OpenTelemetry docs — https://opentelemetry.io/docs/
- OTel traces concept — https://opentelemetry.io/docs/concepts/signals/traces/
- OTel spans — https://opentelemetry.io/docs/concepts/signals/traces/#spans
- OTel JS SDK — https://opentelemetry.io/docs/languages/js/
- OTel JS instrumentation — https://opentelemetry.io/docs/languages/js/instrumentation/
- W3C Trace Context — https://www.w3.org/TR/trace-context/

## Viewer UI

- React Flow (flow/call-graph mode) — https://reactflow.dev
- React Flow API — https://reactflow.dev/api-reference
- D3 (waterfall/race rendering) — https://d3js.org
- D3 scale — https://d3js.org/d3-scale
- Tailwind CSS — https://tailwindcss.com/docs
- shadcn/ui — https://ui.shadcn.com

## Transport (live streaming)

- Server-sent events (MDN) — https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- `EventSource` — https://developer.mozilla.org/en-US/docs/Web/API/EventSource
- `ws` (Node WebSocket) — https://github.com/websockets/ws
- Node HTTP / streams — https://nodejs.org/api/http.html

## Monorepo / tooling

- pnpm workspaces — https://pnpm.io/workspaces
- pnpm CLI — https://pnpm.io/pnpm-cli
- TypeScript docs — https://www.typescriptlang.org/docs/
- tsup (bundling packages) — https://tsup.egoist.dev
- Vitest (tests) — https://vitest.dev
- Vite (viewer dev/build) — https://vite.dev

## Prior art to study

- VizTracer (exact FEE tracing + timeline UI) — https://github.com/gaogaotiantian/viztracer
- Jaeger (trace waterfall) — https://www.jaegertracing.io/docs/
- Grafana Pyroscope (continuous profiling / flame graphs) — https://grafana.com/docs/pyroscope/latest/
- speedscope (interactive flamegraph viewer) — https://www.speedscope.app
- Brendan Gregg — Flame Graphs — https://www.brendangregg.com/flamegraphs.html
- Callgrind / KCachegrind (call-graph profiling) — https://valgrind.org/docs/manual/cl-manual.html
- nyc / istanbul (require hook + AST coverage instrumentation) — https://github.com/istanbuljs/nyc

## Related Sarathi docs

- `AGENTS.md` — product spec, decisions, milestones, conventions.
