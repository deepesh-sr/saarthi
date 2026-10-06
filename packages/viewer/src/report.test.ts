import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import type { Trace } from "@saarthi/core";
import { buildReportHtml } from "./report";

const trace: Trace = {
  traceId: "report-trace",
  root: "root",
  totalMs: 100,
  spans: [
    {
      id: "root",
      parentId: null,
      name: "handleSignup",
      file: "server.js",
      line: 4,
      start: 0,
      end: 100,
      selfMs: 1,
      status: "done",
      calls: 1,
      error: null,
      blockedOn: null,
    },
    {
      id: "hash",
      parentId: "root",
      name: "hashPassword",
      file: "lib/auth.js",
      line: 8,
      start: 10,
      end: 70,
      selfMs: 60,
      status: "done",
      calls: 1,
      error: null,
      blockedOn: null,
    },
    {
      id: "boom",
      parentId: "root",
      name: "boom",
      file: "lib/db.js",
      line: 1,
      start: 75,
      end: 80,
      selfMs: 5,
      status: "failed",
      calls: 1,
      error: { name: "Error", message: "kaboom", caught: false },
      blockedOn: null,
    },
  ],
};

describe("buildReportHtml", () => {
  it("is self-contained: no external scripts, styles, or URLs", () => {
    const html = buildReportHtml(trace);
    expect(html).toContain(trace.traceId);
    expect(html).toContain("hashPassword");
    expect(html).toContain("report-bottleneck");
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+href=/i);
    expect(html).not.toMatch(/https?:\/\//i);
  });

  it("embeds the trace as parseable JSON", () => {
    const html = buildReportHtml(trace);
    const match = html.match(/window\.__SAARTHI_TRACE__=(\{[\s\S]*?\});<\/script>/);
    expect(match).toBeTruthy();
    const parsed = JSON.parse(match![1]!);
    expect(parsed.traceId).toBe("report-trace");
    expect(parsed.spans).toHaveLength(3);
  });

  it("renders the waterfall, sidebar and bottleneck when executed", () => {
    const dom = new JSDOM(buildReportHtml(trace), { runScripts: "dangerously" });
    const doc = dom.window.document;
    expect(doc.querySelectorAll('[data-testid="report-row"]').length).toBe(3);
    expect(doc.querySelectorAll('[data-testid="report-box"]').length).toBe(3);
    const banner = doc.querySelector('[data-testid="report-bottleneck"]');
    expect(banner?.textContent).toContain("hashPassword");
    expect(banner?.textContent).toContain("60%");
  });
});
