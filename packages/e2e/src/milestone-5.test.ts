import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runDev, writeReport } from "saarthi";
import { buildFlowGraph, buildReportHtml } from "@saarthi/viewer";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const fixtureRoot = resolve(repoRoot, "examples/todo-app");

function outDir(name: string): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return resolve(tmpdir(), `saarthi-e2e-${name}-${unique}`);
}

describe("milestone 5 — flow graph and shareable report", () => {
  it("builds a flow graph whose topology matches the captured trace", () => {
    const { trace } = runDev({
      entry: "server.js",
      root: fixtureRoot,
      outDir: outDir("m5-flow"),
      fresh: true,
    });

    const graph = buildFlowGraph(trace.spans);
    expect(graph.nodes).toHaveLength(trace.spans.length);

    const children = trace.spans.filter((span) => span.parentId !== null);
    expect(graph.edges).toHaveLength(children.length);
    for (const child of children) {
      const edge = graph.edges.find((candidate) => candidate.to === child.id)!;
      expect(edge.from).toBe(child.parentId);
    }
  });

  it("writes a self-contained report from a real trace", () => {
    const { trace, file } = runDev({
      entry: "server.js",
      root: fixtureRoot,
      outDir: outDir("m5-report"),
      fresh: true,
    });

    const html = buildReportHtml(trace);
    expect(html).toContain("hashPassword");
    expect(html).not.toMatch(/<script[^>]+src=/i);

    const out = resolve(tmpdir(), `saarthi-report-${Date.now()}.html`);
    const result = writeReport({ traceFile: file, out });
    expect(existsSync(result.file)).toBe(true);

    const written = readFileSync(result.file, "utf8");
    expect(written).toContain(trace.traceId);
    expect(written).toContain("hashPassword");
    expect(written).not.toMatch(/<link[^>]+href=/i);
  });
});
