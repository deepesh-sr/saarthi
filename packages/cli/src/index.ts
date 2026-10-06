import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import Module from "node:module";
import { dirname, resolve, sep } from "node:path";
import { register, startViewerServer, type ViewerServer } from "@saarthi/next";
import { debug, Tracer, type Trace } from "@saarthi/core";

export interface DevOptions {
  entry: string;
  root?: string;
  outDir?: string;
  fresh?: boolean;
  tracer?: Tracer;
}

export interface DevResult {
  trace: Trace;
  file: string;
}

export interface StartDevOptions extends DevOptions {
  ui?: boolean;
  port?: number;
  staticDir?: string;
}

export interface StartDevResult {
  result: DevResult;
  server: ViewerServer | null;
  tracer: Tracer;
}

export function runDev(options: DevOptions): DevResult {
  const root = resolve(options.root ?? process.cwd());
  const outDir = resolve(options.outDir ?? resolve(root, ".saarthi"));
  const entry = resolve(root, options.entry);
  debug("cli", "runDev", { root, entry, outDir, fresh: options.fresh ?? false });

  if (options.fresh) clearCache(root);

  const tracer = register({ root, tracer: options.tracer });
  const requireFromRoot = createRequire(resolve(root, "__saarthi_entry__.js"));
  requireFromRoot(entry);

  const trace = tracer.snapshot();
  mkdirSync(outDir, { recursive: true });
  const file = resolve(outDir, `trace-${trace.traceId}.json`);
  writeFileSync(file, JSON.stringify(trace, null, 2));
  debug("cli", "trace:written", { file, spans: trace.spans.length });
  return { trace, file };
}

export async function startDev(
  options: StartDevOptions,
): Promise<StartDevResult> {
  const tracer = options.tracer ?? new Tracer();
  const staticDir = options.staticDir ?? resolveViewerDir();
  const server =
    options.ui === false
      ? null
      : await startViewerServer({ tracer, port: options.port, staticDir });
  debug("cli", "startDev", { ui: options.ui !== false, url: server?.url });

  const result = runDev({ ...options, tracer });
  return { result, server, tracer };
}

function resolveViewerDir(): string | undefined {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require.resolve("@saarthi/viewer/package.json");
    const dir = resolve(dirname(pkg), "dist/app");
    return existsSync(dir) ? dir : undefined;
  } catch {
    return undefined;
  }
}

function clearCache(root: string): void {
  const cache = (Module as unknown as { _cache: Record<string, unknown> })._cache;
  for (const key of Object.keys(cache)) {
    if (key.startsWith(root + sep)) delete cache[key];
  }
}
