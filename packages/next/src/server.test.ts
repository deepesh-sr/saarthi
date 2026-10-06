import { describe, expect, it } from "vitest";
import { Tracer, type SpanEvent } from "@saarthi/core";
import { startViewerServer } from "./server";

interface Frame {
  event: string;
  data: unknown;
}

async function waitFor(condition: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("viewer server", () => {
  it("streams live spans over SSE and serves a snapshot on connect", async () => {
    const tracer = new Tracer({ traceId: "live" });
    const server = await startViewerServer({ tracer, port: 0 });
    const controller = new AbortController();
    const frames: Frame[] = [];

    try {
      const response = await fetch(`${server.url}/events`, {
        signal: controller.signal,
      });
      expect(response.headers.get("content-type")).toContain("text/event-stream");

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const reading = (async () => {
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let index = buffer.indexOf("\n\n");
            while (index >= 0) {
              const frame = buffer.slice(0, index);
              buffer = buffer.slice(index + 2);
              const eventLine = frame.split("\n").find((l) => l.startsWith("event: "));
              const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
              if (eventLine && dataLine) {
                frames.push({
                  event: eventLine.slice(7),
                  data: JSON.parse(dataLine.slice(6)),
                });
              }
              index = buffer.indexOf("\n\n");
            }
          }
        } catch {
          // aborted by the test
        }
      })();

      await waitFor(() => frames.some((f) => f.event === "trace"));

      const id = tracer.enter("work", "w.ts", 1);
      tracer.waiting(id, "db");
      tracer.exit(id);

      await waitFor(() =>
        frames.some(
          (f) =>
            f.event === "span" &&
            (f.data as SpanEvent).type === "exit" &&
            (f.data as SpanEvent).span.name === "work",
        ),
      );

      const spanFrames = frames
        .filter((f) => f.event === "span")
        .map((f) => f.data as SpanEvent);
      expect(spanFrames.map((f) => f.type)).toEqual(["enter", "waiting", "exit"]);
      expect(spanFrames[0]!.span.status).toBe("running");
      expect(spanFrames[2]!.span.status).toBe("done");

      const snapshot = frames.find((f) => f.event === "snapshot");
      expect(snapshot).toBeTruthy();

      controller.abort();
      await reading;
    } finally {
      await server.close();
    }
  });

  it("serves a fallback page at the root", async () => {
    const tracer = new Tracer({ traceId: "live" });
    const server = await startViewerServer({ tracer, port: 0 });
    try {
      const response = await fetch(server.url + "/");
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("Saarthi");
    } finally {
      await server.close();
    }
  });
});
