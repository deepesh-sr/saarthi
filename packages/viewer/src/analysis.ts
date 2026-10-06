import type { Span, SpanStatus } from "@saarthi/core";
import { computeDepth } from "./layout";

export const DEFAULT_SLOW_MS = 5;

export interface SidebarRow {
  id: string;
  name: string;
  status: SpanStatus;
  totalMs: number;
  selfMs: number | null;
  calls: number;
  file: string;
  line: number;
  depth: number;
}

export type SortKey = "total" | "self" | "name";
export type FilterMode = "all" | "failed" | "waiting" | "slow";

export interface RowFilter {
  mode?: FilterMode;
  query?: string;
  slowMs?: number;
}

export interface Bottleneck {
  spanId: string;
  name: string;
  selfMs: number;
  totalMs: number;
  percent: number;
}

export function buildSidebarRows(
  spans: Span[],
  options: { now?: number } = {},
): SidebarRow[] {
  const byId = new Map(spans.map((span) => [span.id, span]));
  const now = options.now ?? 0;
  return spans.map((span) => ({
    id: span.id,
    name: span.name,
    status: span.status,
    totalMs: round(Math.max((span.end ?? now) - span.start, 0)),
    selfMs: span.selfMs,
    calls: span.calls,
    file: span.file,
    line: span.line,
    depth: computeDepth(byId, span),
  }));
}

export function sortRows(rows: SidebarRow[], key: SortKey): SidebarRow[] {
  const sorted = [...rows];
  if (key === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (key === "self") {
    sorted.sort((a, b) => (b.selfMs ?? -1) - (a.selfMs ?? -1));
  } else {
    sorted.sort((a, b) => b.totalMs - a.totalMs);
  }
  return sorted;
}

export function filterRows(rows: SidebarRow[], filter: RowFilter): SidebarRow[] {
  const mode = filter.mode ?? "all";
  const slowMs = filter.slowMs ?? DEFAULT_SLOW_MS;
  const query = filter.query?.trim().toLowerCase() ?? "";
  return rows.filter((row) => {
    if (mode === "failed" && row.status !== "failed") return false;
    if (mode === "waiting" && row.status !== "waiting") return false;
    if (mode === "slow" && (row.selfMs ?? 0) < slowMs) return false;
    if (query && !row.name.toLowerCase().includes(query)) return false;
    return true;
  });
}

export function computeBottleneck(spans: Span[], totalMs: number): Bottleneck | null {
  let best: Span | null = null;
  let bestSelf = 0;
  for (const span of spans) {
    const self = span.selfMs ?? 0;
    if (best === null || self > bestSelf) {
      best = span;
      bestSelf = self;
    }
  }
  if (!best || bestSelf <= 0) return null;

  const total =
    totalMs > 0
      ? totalMs
      : Math.max(...spans.map((span) => (span.end ?? 0) - span.start), 0);
  const percent = total > 0 ? Math.round((bestSelf / total) * 100) : 0;

  return {
    spanId: best.id,
    name: best.name,
    selfMs: round(bestSelf),
    totalMs: round(total),
    percent,
  };
}

function round(ms: number): number {
  return Math.round(ms * 1000) / 1000;
}
