import type { Span, SpanStatus } from "@saarthi/core";

export interface WaterfallBox {
  id: string;
  name: string;
  parentId: string | null;
  lane: number;
  x: number;
  width: number;
  status: SpanStatus;
  file: string;
  line: number;
  selfMs: number | null;
  totalMs: number;
}

export interface WaterfallLayout {
  boxes: WaterfallBox[];
  lanes: number;
  totalMs: number;
}

export function computeDepth(spans: Map<string, Span>, span: Span): number {
  let depth = 0;
  let parentId = span.parentId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = spans.get(parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parentId;
  }
  return depth;
}

export function layoutWaterfall(
  spans: Span[],
  options: { totalMs?: number } = {},
): WaterfallLayout {
  const byId = new Map(spans.map((span) => [span.id, span]));
  const maxEnd = spans.reduce((max, span) => Math.max(max, span.end ?? 0), 0);
  const totalMs = options.totalMs ?? maxEnd;

  const boxes: WaterfallBox[] = spans.map((span) => {
    const end = span.end ?? totalMs;
    const width = Math.max(end - span.start, 0);
    return {
      id: span.id,
      name: span.name,
      parentId: span.parentId,
      lane: computeDepth(byId, span),
      x: span.start,
      width,
      status: span.status,
      file: span.file,
      line: span.line,
      selfMs: span.selfMs,
      totalMs: width,
    };
  });

  boxes.sort((a, b) => a.x - b.x || a.lane - b.lane);
  const lanes = boxes.reduce((max, box) => Math.max(max, box.lane + 1), 0);
  return { boxes, lanes, totalMs };
}
