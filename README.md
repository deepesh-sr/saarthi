# Sarathi

**सारथि** — a zero-config, dev-only profiling and tracing tool for vibe-coded
Next.js / React apps.

> In the Bhagavad Gita, Krishna is Arjuna's *sarathi* — the charioteer who steers
> him through the battlefield when he is lost. Sarathi is the same for your code:
> it shows you where your app is going and where it stumbles.

You install one command, use your app, and watch the flowchart build itself in
real time. No SDK calls, no manual instrumentation.

```bash
npx sarathi dev
```

## What it shows you

- **Which function called which** — the real execution flow, not a static guess.
- **Where it lags** — per-function timing, with `selfMs` so a fast wrapper around
  a slow child isn't falsely blamed.
- **What's blocked** — spans `waiting` on I/O, DB, network, or `await`.
- **What failed** — failed spans, with the error, and whether it was caught or
  propagated.

## The UI

Two panes:

- **Left — timing sidebar:** one row per function, sortable by total or self
  time; filter by failed / waiting / slow; search by name.
- **Right — race pane:** a waterfall of boxes (position = start, width =
  duration, nested by depth) with a playhead that scrubs 0 → 100%. Toggle to a
  call-graph (flow) view.

Color = status: `done` green, `running` blue, `waiting` grey, `failed` red.

## Coverage

100% of *your* code — functions, methods, arrow functions, components, hooks,
route handlers, server actions. `node_modules` and React internals render as
opaque boundary blocks (opt-in `--include-deps` for full capture).

Dev-only. Production builds are never touched.

## Status

Early development. See `AGENTS.md` (spec), `plan.md` (research + engineering
plan), and `milestone.md` (milestones with end-to-end intent tests).

## License

MIT — see `LICENSE`.
