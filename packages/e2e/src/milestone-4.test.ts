import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { register } from "@saarthi/next";
import { Tracer } from "@saarthi/core";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const fixtureRoot = resolve(repoRoot, "examples/todo-app");

describe("milestone 4 — async correctness on a real trace", () => {
  it("keeps concurrent flows, timers and microtasks correctly parented", async () => {
    const tracer = new Tracer({ traceId: "concurrent" });
    register({ root: fixtureRoot, tracer });
    const requireFromRoot = createRequire(resolve(fixtureRoot, "__entry__.js"));
    requireFromRoot(resolve(fixtureRoot, "server-concurrent.js"));
    await (globalThis as { __concurrent?: Promise<unknown> }).__concurrent;

    const trace = tracer.snapshot();
    const byId = new Map(trace.spans.map((span) => [span.id, span]));
    const byName = (name: string) => trace.spans.filter((span) => span.name === name);

    const main = byName("main")[0]!;
    expect(main.parentId).toBeNull();

    const flows = byName("flow");
    expect(flows).toHaveLength(2);
    for (const flow of flows) {
      expect(flow.parentId).toBe(main.id);
    }

    const childNames = flows.map((flow) =>
      trace.spans
        .filter((span) => span.parentId === flow.id)
        .map((span) => span.name)
        .sort(),
    );
    expect(childNames[0]).toEqual(["persist", "sign", "sleep", "sleep", "validate"]);
    expect(childNames[1]).toEqual(["persist", "sign", "sleep", "sleep", "validate"]);

    const firstChildren = new Set(
      trace.spans.filter((span) => span.parentId === flows[0]!.id).map((span) => span.id),
    );
    for (const span of trace.spans.filter((s) => s.parentId === flows[1]!.id)) {
      expect(firstChildren.has(span.id)).toBe(false);
    }

    expect(byName("afterTimer")[0]!.parentId).toBe(byName("usesTimer")[0]!.id);
    expect(byName("afterMicrotask")[0]!.parentId).toBe(byName("usesMicrotask")[0]!.id);

    for (const span of trace.spans) {
      if (span.parentId !== null) {
        expect(byId.has(span.parentId)).toBe(true);
      }
      expect(span.status).not.toBe("running");
    }
  });
});
