import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import Module from "node:module";
import { resolve, sep } from "node:path";
import { register } from "@sarathi/next";
import { debug, type Trace } from "@sarathi/core";

export interface DevOptions {
  entry: string;
  root?: string;
  outDir?: string;
  fresh?: boolean;
}

export interface DevResult {
  trace: Trace;
  file: string;
}

export function runDev(options: DevOptions): DevResult {
  const root = resolve(options.root ?? process.cwd());
  const outDir = resolve(options.outDir ?? resolve(root, ".sarathi"));
  const entry = resolve(root, options.entry);
  debug("cli", "runDev", { root, entry, outDir, fresh: options.fresh ?? false });

  if (options.fresh) clearCache(root);

  const tracer = register({ root });
  const requireFromRoot = createRequire(resolve(root, "__sarathi_entry__.js"));
  requireFromRoot(entry);

  const trace = tracer.snapshot();
  mkdirSync(outDir, { recursive: true });
  const file = resolve(outDir, `trace-${trace.traceId}.json`);
  writeFileSync(file, JSON.stringify(trace, null, 2));
  debug("cli", "trace:written", { file, spans: trace.spans.length });
  return { trace, file };
}

function clearCache(root: string): void {
  const cache = (Module as unknown as { _cache: Record<string, unknown> })._cache;
  for (const key of Object.keys(cache)) {
    if (key.startsWith(root + sep)) delete cache[key];
  }
}
