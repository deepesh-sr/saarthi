import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { debug, type Trace } from "@saarthi/core";
import { buildReportHtml } from "@saarthi/viewer";

export interface ReportOptions {
  traceFile: string;
  out?: string;
}

export interface ReportResult {
  file: string;
  bytes: number;
}

export function writeReport(options: ReportOptions): ReportResult {
  const traceFile = resolve(options.traceFile);
  const trace = JSON.parse(readFileSync(traceFile, "utf8")) as Trace;
  const html = buildReportHtml(trace);
  const file = resolve(options.out ?? `${traceFile.replace(/\.json$/i, "")}.html`);
  writeFileSync(file, html);
  debug("cli", "report:written", { file, bytes: html.length });
  return { file, bytes: html.length };
}
