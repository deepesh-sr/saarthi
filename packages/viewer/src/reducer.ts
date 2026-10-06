import type { Span, SpanEvent, Trace } from "@saarthi/core";

export interface TraceState {
  traceId: string | null;
  byId: Record<string, Span>;
  order: string[];
  orphanIds: string[];
}

export function createTraceState(traceId: string | null = null): TraceState {
  return { traceId, byId: {}, order: [], orphanIds: [] };
}

export function applyEvent(state: TraceState, event: SpanEvent): TraceState {
  const span = event.span;
  const byId = { ...state.byId, [span.id]: span };
  const order = state.order.includes(span.id)
    ? state.order
    : [...state.order, span.id];
  return {
    ...state,
    byId,
    order,
    orphanIds: recomputeOrphans(byId, order),
  };
}

export function mergeTrace(state: TraceState, trace: Trace): TraceState {
  const byId = { ...state.byId };
  const order = [...state.order];
  for (const span of trace.spans) {
    byId[span.id] = span;
    if (!order.includes(span.id)) order.push(span.id);
  }
  return {
    traceId: trace.traceId,
    byId,
    order,
    orphanIds: recomputeOrphans(byId, order),
  };
}

export function spansInOrder(state: TraceState): Span[] {
  return state.order
    .map((id) => state.byId[id])
    .filter((span): span is Span => span !== undefined);
}

function recomputeOrphans(
  byId: Record<string, Span>,
  order: string[],
): string[] {
  return order.filter((id) => {
    const span = byId[id];
    if (!span) return false;
    return span.parentId !== null && byId[span.parentId] === undefined;
  });
}
