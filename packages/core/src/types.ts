export type SpanStatus = "running" | "waiting" | "done" | "failed";

export interface SpanError {
  name: string;
  message: string;
  stack?: string;
  caught: boolean;
}

export interface Span {
  id: string;
  parentId: string | null;
  name: string;
  file: string;
  line: number;
  start: number;
  end: number | null;
  selfMs: number | null;
  status: SpanStatus;
  calls: number;
  error: SpanError | null;
  blockedOn: string | null;
}

export interface Trace {
  traceId: string;
  root: string;
  totalMs: number;
  spans: Span[];
}

export type SpanEventType = "enter" | "exit" | "waiting";

export interface SpanEvent {
  type: SpanEventType;
  span: Span;
}

export type SpanListener = (event: SpanEvent) => void;
