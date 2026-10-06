#!/usr/bin/env node
import { debug } from "@sarathi/core";
import { runDev } from "./index";

function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function main(argv: string[]): void {
  const [command, entry, ...rest] = argv;
  debug("cli", "main", { command, entry, rest });

  if (command !== "dev" || !entry) {
    console.error("usage: sarathi dev <entry-file> [--root <dir>] [--out <dir>]");
    process.exitCode = 1;
    return;
  }

  const result = runDev({
    entry,
    root: readFlag(rest, "--root"),
    outDir: readFlag(rest, "--out"),
    fresh: true,
  });
  console.log(`sarathi: captured ${result.trace.spans.length} spans -> ${result.file}`);
}

main(process.argv.slice(2));
