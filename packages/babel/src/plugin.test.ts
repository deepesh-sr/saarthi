import { transformSync } from "@babel/core";
import { describe, expect, it } from "vitest";
import { Tracer, installRuntime, uninstallRuntime } from "@saarthi/core";
import saarthiPlugin from "./plugin";

function transform(code: string, filename = "app.ts"): string {
  const result = transformSync(code, {
    filename,
    configFile: false,
    babelrc: false,
    plugins: [[saarthiPlugin, { root: "/proj" }]],
    parserOpts: { plugins: ["typescript"] },
  });
  return result!.code!;
}

function run<T>(code: string, filename = "app.ts"): Tracer {
  const out = transform(code, filename);
  const tracer = new Tracer({ traceId: "t" });
  installRuntime(tracer);
  try {
    new Function(out)();
  } finally {
    uninstallRuntime();
  }
  return tracer;
}

describe("saarthi babel plugin", () => {
  it("wraps a function body in a runner call with an arrow", () => {
    const out = transform("function foo() { return 1; }", "/proj/src/app.ts");
    expect(out).toContain("__saarthi_run");
    expect(out).toContain("=>");
    expect(out).toContain("return 1");
  });

  it("converts an arrow expression body into a block with return", () => {
    const out = transform("const add = (a, b) => a + b;", "/proj/src/math.ts");
    expect(out).toContain("return a + b");
    expect(out).toContain("__saarthi_run");
  });

  it("produces correctly nested spans at runtime", () => {
    const tracer = run(`
      function outer() { inner(); }
      function inner() { return 42; }
      outer();
    `, "/proj/src/flow.ts");
    const spans = tracer.snapshot().spans;
    expect(spans.map((s) => s.name)).toEqual(["outer", "inner"]);
    expect(spans[0]!.parentId).toBeNull();
    expect(spans[1]!.parentId).toBe(spans[0]!.id);
    expect(spans[0]!.file).toBe("src/flow.ts");
    expect(spans[1]!.status).toBe("done");
  });

  it("instruments class constructors/methods and object methods", () => {
    const tracer = run(`
      function helper(pw) { return pw.toUpperCase(); }
      class Auth {
        constructor() { this.ready = true; }
        hash(pw) { return helper(pw); }
      }
      const tools = { wrap(pw) { return "[" + pw + "]"; } };
      new Auth().hash("x");
      tools.wrap("y");
    `, "/proj/src/klass.ts");
    const spans = tracer.snapshot().spans;
    expect(spans.map((s) => s.name)).toEqual(
      expect.arrayContaining(["Auth", "hash", "helper", "wrap"]),
    );
    const hash = spans.find((s) => s.name === "hash")!;
    const helper = spans.find((s) => s.name === "helper")!;
    expect(helper.parentId).toBe(hash.id);
  });

  it("preserves `this` inside methods", () => {
    const out = transform(`
      const counter = {
        value: 2,
        double() { return this.value * 2; }
      };
      globalThis.__thisResult = counter.double();
    `, "/proj/src/this.ts");
    const tracer = new Tracer({ traceId: "t" });
    installRuntime(tracer);
    try {
      new Function(out)();
    } finally {
      uninstallRuntime();
    }
    expect((globalThis as { __thisResult?: number }).__thisResult).toBe(4);
    expect(tracer.snapshot().spans.find((s) => s.name === "double")!.status).toBe("done");
  });

  it("instruments async functions and preserves the awaited result", async () => {
    const out = transform(`
      async function inner() { return 1; }
      async function outer() { const v = await inner(); return v + 1; }
      globalThis.__asyncResult = outer();
    `, "/proj/src/async.ts");
    const tracer = new Tracer({ traceId: "t" });
    installRuntime(tracer);
    try {
      new Function(out)();
      const value = await (globalThis as { __asyncResult?: Promise<number> }).__asyncResult;
      expect(value).toBe(2);
    } finally {
      uninstallRuntime();
    }
    const spans = tracer.snapshot().spans;
    const inner = spans.find((s) => s.name === "inner")!;
    const outer = spans.find((s) => s.name === "outer")!;
    expect(inner.parentId).toBe(outer.id);
    expect(outer.status).toBe("done");
  });

  it("skips generator functions", () => {
    const out = transform("function* gen() { yield 1; }", "/proj/src/g.ts");
    expect(out).not.toContain("__saarthi_run");
  });

  it("preserves directive prologues", () => {
    const out = transform('function f() { "use strict"; return 1; }', "/proj/src/s.ts");
    expect(out).toContain('"use strict"');
    expect(out).toContain("__saarthi_run");
  });

  it("skips functions where a var would shadow a parameter", () => {
    const out = transform(
      "function f(x) { var x = x || 1; return x; }",
      "/proj/src/v.ts",
    );
    expect(out).not.toContain("__saarthi_run");
  });

  it("does not instrument a function twice", () => {
    const out = transform("function foo() { return 1; }", "/proj/src/a.ts");
    const count = out.match(/__saarthi_run/g)?.length ?? 0;
    expect(count).toBe(1);
  });
});
