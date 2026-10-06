import { useMemo, useState } from "react";
import type { Span } from "@saarthi/core";
import { layoutWaterfall } from "./layout";
import { buildFlowGraph } from "./flow";
import {
  buildSidebarRows,
  computeBottleneck,
  filterRows,
  sortRows,
  type FilterMode,
  type RowFilter,
  type SortKey,
} from "./analysis";
import { Sidebar } from "./Sidebar";
import { Waterfall } from "./Waterfall";
import { Flow } from "./FlowView";

export interface TraceViewProps {
  spans: Span[];
  traceId?: string | null;
  connected?: boolean;
}

type View = "race" | "flow";

export function TraceView({
  spans,
  traceId = null,
  connected = false,
}: TraceViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("self");
  const [filter, setFilter] = useState<RowFilter>({ mode: "all", query: "" });
  const [view, setView] = useState<View>("race");

  const layout = useMemo(() => layoutWaterfall(spans), [spans]);
  const graph = useMemo(() => buildFlowGraph(spans), [spans]);
  const rows = useMemo(
    () => filterRows(sortRows(buildSidebarRows(spans), sortKey), filter),
    [spans, sortKey, filter],
  );
  const bottleneck = useMemo(
    () => computeBottleneck(spans, layout.totalMs),
    [spans, layout.totalMs],
  );

  return (
    <div className="app">
      <header className="header">
        <strong>Saarthi</strong>
        <span className="trace">{traceId ?? "waiting for a trace…"}</span>
        <span className={`conn ${connected ? "on" : "off"}`}>
          {connected ? "live" : "offline"}
        </span>
        <div className="view-toggle">
          <button
            type="button"
            className={view === "race" ? "active" : ""}
            onClick={() => setView("race")}
          >
            race
          </button>
          <button
            type="button"
            className={view === "flow" ? "active" : ""}
            onClick={() => setView("flow")}
          >
            flow
          </button>
        </div>
        {layout.totalMs > 0 && (
          <span className="total">{layout.totalMs.toFixed(1)} ms</span>
        )}
      </header>

      <div className="body">
        <Sidebar
          rows={rows}
          totalMs={layout.totalMs}
          sortKey={sortKey}
          filter={filter}
          selectedId={selectedId}
          bottleneck={bottleneck}
          onSortChange={setSortKey}
          onFilterChange={(mode: FilterMode) =>
            setFilter((current) => ({ ...current, mode }))
          }
          onQueryChange={(query: string) =>
            setFilter((current) => ({ ...current, query }))
          }
          onSelect={setSelectedId}
        />

        <main className="pane">
          {layout.boxes.length === 0 ? (
            <p className="empty">
              Interact with your app — spans will appear here live.
            </p>
          ) : view === "race" ? (
            <Waterfall
              layout={layout}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <Flow graph={graph} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </main>
      </div>

      <footer className="legend">
        <span className="done">done</span>
        <span className="running">running</span>
        <span className="waiting">waiting</span>
        <span className="failed">failed</span>
      </footer>
    </div>
  );
}
