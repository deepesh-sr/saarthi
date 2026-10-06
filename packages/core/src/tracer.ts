import { now as defaultNow, round } from "./clock";
import { debug } from "./debug";
import { defaultTraceId } from "./ids";
import type { Span, SpanError, SpanEvent, SpanListener, Trace } from "./types";

export interface TracerOptions {
  traceId?: string;
  now?: () => number;
}

interface ActiveSpan {
  span: Span;
  childrenTotal: number;
}

export class Tracer {
  readonly traceId: string;
  private readonly clock: () => number;
  private readonly startTime: number;
  private counter = 0;
  private readonly spans: Span[] = [];
  private readonly active = new Map<string, ActiveSpan>();
  private readonly listeners = new Set<SpanListener>();

  constructor(options: TracerOptions = {}) {
    this.traceId = options.traceId ?? defaultTraceId();
    this.clock = options.now ?? defaultNow;
    this.startTime = this.clock();
    debug("core", "tracer:init", this.traceId);
  }

  enter(
    name: string,
    file: string,
    line: number,
    parentId: string | null = null,
  ): string {
    const id = `s${++this.counter}`;
    debug("core", "enter", { id, name, file, line, parentId });
    const span: Span = {
      id,
      parentId,
      name,
      file,
      line,
      start: this.offset(),
      end: null,
      selfMs: null,
      status: "running",
      calls: 1,
      error: null,
      blockedOn: null,
    };
    this.spans.push(span);
    this.active.set(id, { span, childrenTotal: 0 });
    this.emit({ type: "enter", span: cloneSpan(span) });
    return id;
  }

  exit(id: string, error?: unknown): void {
    const active = this.active.get(id);
    if (!active) return;

    const span = active.span;
    span.end = this.offset();
    if (error !== undefined) {
      span.status = "failed";
      span.error = toSpanError(error);
    } else {
      span.status = "done";
    }
    span.selfMs = round(span.end - span.start - active.childrenTotal);
    this.active.delete(id);
    debug("core", "exit", { id, status: span.status, selfMs: span.selfMs });
    this.emit({ type: "exit", span: cloneSpan(span) });

    if (span.parentId) {
      const parent = this.active.get(span.parentId);
      if (parent) parent.childrenTotal += span.end - span.start;
    }
  }

  waiting(id: string, blockedOn: string): void {
    const active = this.active.get(id);
    if (!active) return;
    active.span.status = "waiting";
    active.span.blockedOn = blockedOn;
    debug("core", "waiting", { id, blockedOn });
    this.emit({ type: "waiting", span: cloneSpan(active.span) });
  }

  subscribe(listener: SpanListener): () => void {
    this.listeners.add(listener);
    debug("core", "subscribe", { listeners: this.listeners.size });
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot(): Trace {
    const spans = this.spans.map(cloneSpan);
    resolveCaught(spans);
    const root = spans.find((s) => s.parentId === null);
    const maxEnd = spans.reduce((max, span) => Math.max(max, span.end ?? 0), 0);
    const totalMs = maxEnd > 0 ? round(maxEnd) : this.offset();
    debug("core", "snapshot", { spans: spans.length, root: root?.id, totalMs });
    return {
      traceId: this.traceId,
      root: root ? root.id : "",
      totalMs,
      spans,
    };
  }

  private offset(): number {
    return round(this.clock() - this.startTime);
  }

  private emit(event: SpanEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        debug("core", "listener:error", error);
      }
    }
  }
}

function cloneSpan(span: Span): Span {
  return {
    ...span,
    error: span.error ? { ...span.error } : null,
  };
}

function resolveCaught(spans: Span[]): void {
  const byId = new Map(spans.map((s) => [s.id, s]));
  for (const span of spans) {
    if (!span.error) continue;
    let parentId = span.parentId;
    let caught = false;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) break;
      if (parent.status === "done") {
        caught = true;
        break;
      }
      parentId = parent.parentId;
    }
    span.error.caught = caught;
  }
}

export function toSpanError(error: unknown): SpanError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      caught: false,
    };
  }
  return {
    name: "Error",
    message: String(error),
    caught: false,
  };
}
