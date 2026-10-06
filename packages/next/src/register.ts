import Module from "node:module";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";
import { transformSync } from "@babel/core";
import { sarathiPlugin } from "@sarathi/babel";
import { debug, installRuntime, Tracer } from "@sarathi/core";

export interface RegisterOptions {
  root: string;
  tracer?: Tracer;
}

type ExtensionHandler = (module: NodeModule, filename: string) => void;

interface ModuleInternals {
  _extensions: Record<string, ExtensionHandler>;
}

let registered = false;

export function register(options: RegisterOptions): Tracer {
  const root = resolve(options.root);
  const tracer = options.tracer ?? new Tracer();
  installRuntime(tracer);
  debug("next", "register", { root, traceId: tracer.snapshot().traceId });

  const internals = Module as unknown as ModuleInternals;
  const original = internals._extensions[".js"];
  if (!original) {
    throw new Error("sarathi: could not access Module._extensions['.js']");
  }

  internals._extensions[".js"] = (module, filename) => {
    if (!shouldInstrument(filename, root)) {
      original(module, filename);
      return;
    }
    debug("next", "transform", { filename });
    const code = readFileSync(filename, "utf8");
    const result = transformSync(code, {
      filename,
      configFile: false,
      babelrc: false,
      sourceMaps: "inline",
      plugins: [[sarathiPlugin, { root }]],
    });
    (module as unknown as { _compile: (code: string, filename: string) => void })._compile(
      result!.code!,
      filename,
    );
  };

  registered = true;
  return tracer;
}

export function isRegistered(): boolean {
  return registered;
}

function shouldInstrument(filename: string, root: string): boolean {
  if (!isAbsolute(filename)) return false;
  if (filename.includes(`${sep}node_modules${sep}`)) return false;
  return filename === root || filename.startsWith(root + sep);
}
