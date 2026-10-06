import { describe, expect, it } from "vitest";
import { Tracer } from "./tracer";
import { runInSpan } from "./context";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function names(tracer: Tracer): string[] {
  return tracer.snapshot().spans.map((s) => s.name);
}

function parentOf(tracer: Tracer, name: string, occurrence = 0) {
  const spans = tracer.snapshot().spans.filter((s) => s.name === name);
  const span = spans[occurrence]!;
  const parent = tracer
    .snapshot()
    .spans.find((s) => s.id === span.parentId);
  return parent?.name ?? null;
}

describe("async context propagation", () => {
  it("nests synchronously", () => {
    const tracer = new Tracer({ traceId: "t" });
    runInSpan(tracer, "outer", "a.ts", 1, () => {
      runInSpan(tracer, "inner", "a.ts", 2, () => 1);
    });
    expect(names(tracer)).toEqual(["outer", "inner"]);
    expect(parentOf(tracer, "inner")).toBe("outer");
  });

  it("keeps the parent across an await", async () => {
    const tracer = new Tracer({ traceId: "t" });
    await runInSpan(tracer, "outer", "a.ts", 1, async () => {
      await delay(5);
      runInSpan(tracer, "inner", "a.ts", 2, () => 1);
    });
    expect(parentOf(tracer, "inner")).toBe("outer");
    const outer = tracer.snapshot().spans.find((s) => s.name === "outer")!;
    expect(outer.status).toBe("done");
  });

  it("does not leak a callee's context into the caller after it returns", async () => {
    const tracer = new Tracer({ traceId: "t" });
    await runInSpan(tracer, "caller", "a.ts", 1, async () => {
      await runInSpan(tracer, "callee", "a.ts", 2, async () => {
        await delay(3);
      });
      runInSpan(tracer, "after", "a.ts", 3, () => 1);
    });
    expect(parentOf(tracer, "after")).toBe("caller");
  });

  it("keeps concurrent flows from cross-talking", async () => {
    const tracer = new Tracer({ traceId: "t" });
    await Promise.all([
      runInSpan(tracer, "flowA", "a.ts", 1, async () => {
        await delay(8);
        runInSpan(tracer, "aChild", "a.ts", 2, () => 1);
      }),
      runInSpan(tracer, "flowB", "a.ts", 3, async () => {
        await delay(2);
        runInSpan(tracer, "bChild", "a.ts", 4, () => 1);
      }),
    ]);

    expect(parentOf(tracer, "flowA")).toBeNull();
    expect(parentOf(tracer, "flowB")).toBeNull();
    expect(parentOf(tracer, "aChild")).toBe("flowA");
    expect(parentOf(tracer, "bChild")).toBe("flowB");
  });

  it("survives timer and microtask boundaries", async () => {
    const tracer = new Tracer({ traceId: "t" });
    await runInSpan(tracer, "timer", "a.ts", 1, async () => {
      await delay(4);
      runInSpan(tracer, "afterTimer", "a.ts", 2, () => 1);
      await Promise.resolve();
      runInSpan(tracer, "afterMicrotask", "a.ts", 3, () => 1);
    });
    expect(parentOf(tracer, "afterTimer")).toBe("timer");
    expect(parentOf(tracer, "afterMicrotask")).toBe("timer");
  });

  it("nests parallel children under the same flow", async () => {
    const tracer = new Tracer({ traceId: "t" });
    await runInSpan(tracer, "fanout", "a.ts", 1, async () => {
      await Promise.all([
        runInSpan(tracer, "left", "a.ts", 2, async () => delay(5)),
        runInSpan(tracer, "right", "a.ts", 3, async () => delay(2)),
      ]);
    });
    expect(parentOf(tracer, "left")).toBe("fanout");
    expect(parentOf(tracer, "right")).toBe("fanout");
  });

  it("marks an async throw failed and rethrows", async () => {
    const tracer = new Tracer({ traceId: "t" });
    await expect(
      runInSpan(tracer, "boom", "a.ts", 1, async () => {
        await delay(2);
        throw new Error("async-kaboom");
      }),
    ).rejects.toThrow("async-kaboom");

    const span = tracer.snapshot().spans.find((s) => s.name === "boom")!;
    expect(span.status).toBe("failed");
    expect(span.error?.message).toBe("async-kaboom");
  });

  it("keeps a span open until a returned promise settles", async () => {
    const tracer = new Tracer({ traceId: "t" });
    const promise = runInSpan(tracer, "syncPromise", "a.ts", 1, () => delay(6));
    expect(tracer.snapshot().spans[0]!.status).toBe("running");
    await promise;
    expect(tracer.snapshot().spans[0]!.status).toBe("done");
  });

  it("attributes concurrent interleaving without orphaned spans", async () => {
    const tracer = new Tracer({ traceId: "t" });
    await Promise.all([
      runInSpan(tracer, "first", "a.ts", 1, async () => {
        await delay(10);
        runInSpan(tracer, "firstChild", "a.ts", 2, () => 1);
      }),
      runInSpan(tracer, "second", "a.ts", 3, async () => {
        await delay(1);
        runInSpan(tracer, "secondChild", "a.ts", 4, () => 1);
      }),
    ]);

    const spans = tracer.snapshot().spans;
    const ids = new Set(spans.map((s) => s.id));
    for (const span of spans) {
      if (span.parentId !== null) expect(ids.has(span.parentId)).toBe(true);
    }
  });
});
