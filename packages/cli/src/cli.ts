#!/usr/bin/env node
import { debug } from "@sarathi/core";
import { startDev } from "./index";

function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const [command, entry, ...rest] = argv;
  debug("cli", "main", { command, entry, rest });

  if (command !== "dev" || !entry) {
    console.error(
      "usage: sarathi dev <entry-file> [--root <dir>] [--out <dir>] [--port <n>] [--no-ui]",
    );
    process.exitCode = 1;
    return;
  }

  const portFlag = readFlag(rest, "--port");
  const { result, server } = await startDev({
    entry,
    root: readFlag(rest, "--root"),
    outDir: readFlag(rest, "--out"),
    fresh: true,
    ui: !rest.includes("--no-ui"),
    port: portFlag ? Number(portFlag) : undefined,
  });

  if (server) {
    console.log(`sarathi: viewer at ${server.url}`);
  }
  console.log(`sarathi: captured ${result.trace.spans.length} spans -> ${result.file}`);

  if (server) {
    const shutdown = async () => {
      await server.close();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
}

main(process.argv.slice(2)).catch((error) => {
  console.error("sarathi: failed", error);
  process.exitCode = 1;
});
