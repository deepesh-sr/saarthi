#!/usr/bin/env node
import { debug } from "@saarthi/core";
import { startDev } from "./index";
import { writeReport } from "./report";

function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  const [command, target, ...rest] = argv;
  debug("cli", "main", { command, target, rest });

  if (command === "report") {
    if (!target) {
      console.error("usage: saarthi report <trace.json> [--out <file>]");
      process.exitCode = 1;
      return;
    }
    const { file } = writeReport({ traceFile: target, out: readFlag(rest, "--out") });
    console.log(`saarthi: wrote report -> ${file}`);
    return;
  }

  if (command !== "dev" || !target) {
    console.error(
      "usage: saarthi dev <entry-file> [--root <dir>] [--out <dir>] [--port <n>] [--no-ui]\n" +
        "       saarthi report <trace.json> [--out <file>]",
    );
    process.exitCode = 1;
    return;
  }

  const portFlag = readFlag(rest, "--port");
  const { result, server } = await startDev({
    entry: target,
    root: readFlag(rest, "--root"),
    outDir: readFlag(rest, "--out"),
    fresh: true,
    ui: !rest.includes("--no-ui"),
    port: portFlag ? Number(portFlag) : undefined,
  });

  if (server) {
    console.log(`saarthi: viewer at ${server.url}`);
  }
  console.log(`saarthi: captured ${result.trace.spans.length} spans -> ${result.file}`);

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
  console.error("saarthi: failed", error);
  process.exitCode = 1;
});
