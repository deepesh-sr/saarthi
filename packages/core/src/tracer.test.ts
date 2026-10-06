import { describe, expect, it } from "vitest";
import { Tracer } from "./tracer";
import { installRuntime, uninstallRuntime } from "./runtime";

function fakeClock() {
  let t = 0;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("Tracer", () => {
  it("nests spans by call order and attributes self-time", () => {
    const c = fakeClock();
    const tracer = new Tracer({ traceId: "t", now: c.now });

    const a = tracer.enter("handleSignup", "actions.ts", 12);
    c.advance(10);
    const b = tracer.enter("hashPassword", "auth.ts", 30);
    c.advance(20);
    tracer.exit(b);
    c.advance(5);
    tracer.exit(a);

    const trace = tracer.snapshot();
    const spanA = trace.spans.find((s) => s.id === a)!;
    const spanB = trace.spans.find((s) => s.id === b)!;

    expect(trace.spans).toHaveLength(2);
    expect(trace.root).toBe(a);
    expect(spanA.parentId).toBeNull();
    expect(spanB.parentId).toBe(a);

    expect(spanB.start).toBe(10);
    expect(spanB.end).toBe(30);
    expect(spanB.start).toBeGreaterThanOrEqual(spanA.start);
    expect(spanB.end!).toBeLessThanOrEqual(spanA.end!);

    expect(spanB.selfMs).toBe(20);
    expect(spanA.selfMs).toBe(15);
    expect(spanA.selfMs!).toBeLessThan(spanA.end! - spanA.start);
  });

  it("reports a transient waiting status while blocked", () => {
    const c = fakeClock();
    const tracer = new Tracer({ traceId: "t", now: c.now });

    const a = tracer.enter("dbInsert", "db.ts", 5);
    tracer.waiting(a, "postgres");

    const live = tracer.snapshot().spans[0]!;
    expect(live.status).toBe("waiting");
    expect(live.blockedOn).toBe("postgres");
    expect(live.end).toBeNull();
  });

  it("marks a thrown span failed and caught when a caller absorbs it", () => {
    const c = fakeClock();
    const tracer = new Tracer({ traceId: "t", now: c.now });

    const a = tracer.enter("caller", "app.ts", 1);
    c.advance(1);
    const b = tracer.enter("boom", "app.ts", 9);
    c.advance(2);
    tracer.exit(b, new Error("kaboom"));
    tracer.exit(a);

    const trace = tracer.snapshot();
    const spanA = trace.spans.find((s) => s.id === a)!;
    const spanB = trace.spans.find((s) => s.id === b)!;

    expect(spanB.status).toBe("failed");
    expect(spanB.error?.name).toBe("Error");
    expect(spanB.error?.message).toBe("kaboom");
    expect(spanB.error?.caught).toBe(true);
    expect(spanA.status).toBe("done");
  });

  it("marks an error propagated (not caught) when it reaches the root", () => {
    const c = fakeClock();
    const tracer = new Tracer({ traceId: "t", now: c.now });

    const a = tracer.enter("root", "app.ts", 1);
    const b = tracer.enter("boom", "app.ts", 9);
    const err = new Error("kaboom");
    tracer.exit(b, err);
    tracer.exit(a, err);

    const trace = tracer.snapshot();
    const spanA = trace.spans.find((s) => s.id === a)!;
    const spanB = trace.spans.find((s) => s.id === b)!;

    expect(spanB.status).toBe("failed");
    expect(spanB.error?.caught).toBe(false);
    expect(spanA.status).toBe("failed");
  });

  it("streams enter/exit/waiting events to subscribers in order", () => {
    const c = fakeClock();
    const tracer = new Tracer({ traceId: "t", now: c.now });
    const events: string[] = [];
    const unsubscribe = tracer.subscribe((event) => {
      events.push(`${event.type}:${event.span.name}`);
    });

    const a = tracer.enter("outer", "a.ts", 1);
    const b = tracer.enter("inner", "a.ts", 5);
    tracer.waiting(b, "db");
    tracer.exit(b);
    tracer.exit(a);
    unsubscribe();
    tracer.enter("after", "a.ts", 9);

    expect(events).toEqual([
      "enter:outer",
      "enter:inner",
      "waiting:inner",
      "exit:inner",
      "exit:outer",
    ]);
  });

  it("exposes a live running span before it exits", () => {
    const c = fakeClock();
    const tracer = new Tracer({ traceId: "t", now: c.now });
    const seen: { type: string; status: string }[] = [];
    tracer.subscribe((event) => {
      seen.push({ type: event.type, status: event.span.status });
    });

    const id = tracer.enter("work", "w.ts", 1);
    tracer.exit(id);

    expect(seen[0]).toEqual({ type: "enter", status: "running" });
    expect(seen[1]).toEqual({ type: "exit", status: "done" });
  });

  it("exposes enter/exit through the installed runtime globals", () => {
    const c = fakeClock();
    const tracer = new Tracer({ traceId: "t", now: c.now });
    installRuntime(tracer);
    try {
      const id = globalThis.__sarathi_enter!("handler", "route.ts", 7);
      c.advance(3);
      globalThis.__sarathi_exit!(id);
      const span = tracer.snapshot().spans[0]!;
      expect(span.name).toBe("handler");
      expect(span.file).toBe("route.ts");
      expect(span.status).toBe("done");
    } finally {
      uninstallRuntime();
    }
  });
});
