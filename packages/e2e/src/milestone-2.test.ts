import { createRequire } from "node:module";
import Module from "node:module";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { register, startViewerServer } from "@sarathi/next";
import { Tracer, type Span, type SpanEvent } from "@sarathi/core";
import {
  applyEvent,
  createTraceState,
  layoutWaterfall,
  spansInOrder,
} from "@sarathi/viewer";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const fixtureRoot = resolve(repoRoot, "examples/todo-app");

interface Frame {
  event: string;
  data: unknown;
}

function openStream(url: string): {
  frames: Frame[];
  stop: () => void;
  done: Promise<void>;
} {
  const frames: Frame[] = [];
  const controller = new AbortController();
  const done = (async () => {
    try {
      const response = await fetch(`${url}/events`, {
        signal: controller.signal,
      });
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done: finished } = await reader.read();
        if (finished) break;
        buffer += decoder.decode(value, { stream: true });
        let index = buffer.indexOf("\n\n");
        while (index >= 0) {
          const frame = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          const eventLine = frame.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
          if (eventLine && dataLine) {
            frames.push({
              event: eventLine.slice(7),
              data: JSON.parse(dataLine.slice(6)),
            });
          }
          index = buffer.indexOf("\n\n");
        }
      }
    } catch {
      // aborted by the test
    }
  })();
  return { frames, stop: () => controller.abort(), done };
}

async function waitFor(condition: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 5));
  }
}

function clearFixtureCache(): void {
  const cache = (Module as unknown as { _cache: Record<string, unknown> })._cache;
  for (const key of Object.keys(cache)) {
    if (key.startsWith(fixtureRoot + sep)) delete cache[key];
  }
}

describe("milestone 2 — live waterfall", () => {
  it("streams a running box before the request completes, then re-parents cleanly", async () => {
    const tracer = new Tracer({ traceId: "live" });
    const server = await startViewerServer({ tracer, port: 0 });
    const stream = openStream(server.url);

    try {
      await waitFor(() => stream.frames.some((f) => f.event === "trace"));

      register({ root: fixtureRoot, tracer });
      const requireFromRoot = createRequire(resolve(fixtureRoot, "__entry__.js"));
      requireFromRoot(resolve(fixtureRoot, "server-async.js"));

      await (globalThis as { __asyncSignup?: Promise<unknown> }).__asyncSignup;
      await waitFor(() =>
        stream.frames.some(
          (f) =>
            f.event === "span" &&
            (f.data as SpanEvent).type === "exit" &&
            (f.data as SpanEvent).span.name === "handleSignup",
        ),
      );
    } finally {
      stream.stop();
      await stream.done;
      await server.close();
    }

    const spanFrames = stream.frames
      .filter((f) => f.event === "span")
      .map((f) => f.data as SpanEvent);

    const rootEnter = spanFrames.findIndex(
      (f) => f.type === "enter" && f.span.name === "handleSignup",
    );
    const rootExit = spanFrames.findIndex(
      (f) => f.type === "exit" && f.span.name === "handleSignup",
    );

    expect(rootEnter).toBeGreaterThanOrEqual(0);
    expect(rootEnter).toBeLessThan(rootExit);
    expect(spanFrames[rootEnter]!.span.status).toBe("running");
    expect(spanFrames.length).toBeGreaterThan(6);

    const state = spanFrames.reduce(
      (current, event) => applyEvent(current, event),
      createTraceState("live"),
    );
    expect(state.orphanIds).toEqual([]);

    const spans = spansInOrder(state);
    expect(spans.map((s) => s.name)).toEqual(
      expect.arrayContaining(["handleSignup", "hashPassword", "insert"]),
    );
  });

  it("renders geometry that matches the captured trace", async () => {
    const tracer = new Tracer({ traceId: "geometry" });
    register({ root: fixtureRoot, tracer });
    clearFixtureCache();
    const requireFromRoot = createRequire(resolve(fixtureRoot, "__entry__.js"));
    requireFromRoot(resolve(fixtureRoot, "server-async.js"));
    await (globalThis as { __asyncSignup?: Promise<unknown> }).__asyncSignup;

    const trace = tracer.snapshot();
    const { boxes, lanes, totalMs } = layoutWaterfall(trace.spans);

    const root = trace.spans.find((s) => s.name === "handleSignup")!;
    const rootBox = boxes.find((b) => b.id === root.id)!;
    expect(rootBox.lane).toBe(0);
    expect(lanes).toBeGreaterThanOrEqual(2);

    for (const span of trace.spans) {
      const box = boxes.find((b) => b.id === span.id)!;
      const parent = trace.spans.find((s) => s.id === span.parentId);
      if (parent) {
        const parentBox = boxes.find((b) => b.id === parent.id)!;
        expect(box.x).toBeGreaterThanOrEqual(parentBox.x);
        expect(box.x + box.width).toBeLessThanOrEqual(
          parentBox.x + parentBox.width + 0.001,
        );
        expect(box.lane).toBe(parentBox.lane + 1);
      }
    }

    expect(totalMs).toBeGreaterThan(50);
    const statuses = new Set(boxes.map((b) => b.status));
    expect(statuses.has("done")).toBe(true);
  });

  it("re-parents a child that arrives before its parent", () => {
    const child: Span = {
      id: "c",
      parentId: "p",
      name: "child",
      file: "f.ts",
      line: 1,
      start: 0,
      end: null,
      selfMs: null,
      status: "running",
      calls: 1,
      error: null,
      blockedOn: null,
    };
    let state = createTraceState("t");
    state = applyEvent(state, { type: "enter", span: child });
    expect(state.orphanIds).toEqual(["c"]);

    state = applyEvent(state, {
      type: "enter",
      span: { ...child, id: "p", parentId: null, name: "parent" },
    });
    expect(state.orphanIds).toEqual([]);
  });
});
