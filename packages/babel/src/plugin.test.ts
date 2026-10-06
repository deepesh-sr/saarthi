import { transformSync } from "@babel/core";
import { describe, expect, it } from "vitest";
import { Tracer, installRuntime, uninstallRuntime } from "@sarathi/core";
import sarathiPlugin from "./plugin";

function transform(code: string, filename = "app.ts"): string {
  const result = transformSync(code, {
    filename,
    configFile: false,
    babelrc: false,
    plugins: [[sarathiPlugin, { root: "/proj" }]],
    parserOpts: { plugins: ["typescript"] },
  });
  return result!.code!;
}

describe("sarathi babel plugin", () => {
  it("wraps a function body with enter/exit inside try/finally", () => {
    const out = transform("function foo() { return 1; }", "/proj/src/app.ts");
    expect(out).toContain("__sarathi_enter");
    expect(out).toContain("__sarathi_exit");
    expect(out).toContain("try");
    expect(out).toContain("finally");
  });

  it("converts an arrow expression body into a block with return", () => {
    const out = transform("const add = (a, b) => a + b;", "/proj/src/math.ts");
    expect(out).toContain("return a + b");
  });

  it("produces correctly nested spans at runtime", () => {
    const code = `
      function outer() { inner(); }
      function inner() { return 42; }
      outer();
    `;
    const out = transform(code, "/proj/src/flow.ts");
    const tracer = new Tracer({ traceId: "t" });
    installRuntime(tracer);
    try {
      new Function(out)();
    } finally {
      uninstallRuntime();
    }

    const spans = tracer.snapshot().spans;
    expect(spans.map((s) => s.name)).toEqual(["outer", "inner"]);
    expect(spans[0]!.parentId).toBeNull();
    expect(spans[1]!.parentId).toBe(spans[0]!.id);
    expect(spans[0]!.file).toBe("src/flow.ts");
    expect(spans[1]!.status).toBe("done");
  });

  it("marks a thrown function failed while leaving app behavior unchanged", () => {
    const code = `
      function caller() {
        try { boom(); } catch (e) { globalThis.__caught = e.message; }
      }
      function boom() { throw new Error("nope"); }
      caller();
    `;
    const out = transform(code, "/proj/src/err.ts");
    const tracer = new Tracer({ traceId: "t" });
    installRuntime(tracer);
    try {
      new Function(out)();
    } finally {
      uninstallRuntime();
    }

    expect((globalThis as { __caught?: string }).__caught).toBe("nope");
    const spans = tracer.snapshot().spans;
    const boom = spans.find((s) => s.name === "boom")!;
    const caller = spans.find((s) => s.name === "caller")!;
    expect(boom.status).toBe("failed");
    expect(boom.error?.message).toBe("nope");
    expect(boom.error?.caught).toBe(true);
    expect(caller.status).toBe("done");
  });

  it("does not instrument functions twice when applied once", () => {
    const out = transform("function foo() { return 1; }", "/proj/src/a.ts");
    const count = out.match(/__sarathi_enter/g)?.length ?? 0;
    expect(count).toBe(1);
  });

  it("instruments class constructors/methods and object methods", () => {
    const code = `
      function helper(pw) { return pw.toUpperCase(); }
      class Auth {
        constructor() { this.ready = true; }
        hash(pw) { return helper(pw); }
      }
      const tools = { wrap(pw) { return "[" + pw + "]"; } };
      new Auth().hash("x");
      tools.wrap("y");
    `;
    const out = transform(code, "/proj/src/klass.ts");
    const tracer = new Tracer({ traceId: "t" });
    installRuntime(tracer);
    try {
      new Function(out)();
    } finally {
      uninstallRuntime();
    }
    const names = tracer.snapshot().spans.map((s) => s.name);
    expect(names).toEqual(
      expect.arrayContaining(["Auth", "hash", "helper", "wrap"]),
    );
    const spans = tracer.snapshot().spans;
    const hash = spans.find((s) => s.name === "hash")!;
    const helper = spans.find((s) => s.name === "helper")!;
    expect(helper.parentId).toBe(hash.id);
  });

  it("instruments async functions and preserves the awaited result", async () => {
    const code = `
      async function inner() { return 1; }
      async function outer() { const v = await inner(); return v + 1; }
      globalThis.__asyncResult = outer();
    `;
    const out = transform(code, "/proj/src/async.ts");
    const tracer = new Tracer({ traceId: "t" });
    installRuntime(tracer);
    try {
      new Function(out)();
      await (globalThis as { __asyncResult?: Promise<number> }).__asyncResult;
    } finally {
      uninstallRuntime();
    }
    expect(await Promise.resolve(2)).toBe(2);
    const spans = tracer.snapshot().spans;
    const inner = spans.find((s) => s.name === "inner")!;
    const outer = spans.find((s) => s.name === "outer")!;
    expect(inner.parentId).toBe(outer.id);
    expect(outer.status).toBe("done");
  });
});
