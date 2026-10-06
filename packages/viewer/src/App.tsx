import { useEffect, useMemo, useState } from "react";
import type { SpanEvent, Trace } from "@sarathi/core";
import { layoutWaterfall } from "./layout";
import { applyEvent, createTraceState, mergeTrace, spansInOrder } from "./reducer";
import { Waterfall } from "./Waterfall";

export function App() {
  const [state, setState] = useState(() => createTraceState());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource("/events");
    source.addEventListener("open", () => setConnected(true));
    source.addEventListener("error", () => setConnected(false));
    source.addEventListener("snapshot", (event) => {
      const trace = JSON.parse((event as MessageEvent).data) as Trace;
      setState((current) => mergeTrace(current, trace));
    });
    source.addEventListener("span", (event) => {
      const spanEvent = JSON.parse((event as MessageEvent).data) as SpanEvent;
      setState((current) => applyEvent(current, spanEvent));
    });
    return () => source.close();
  }, []);

  const spans = spansInOrder(state);
  const layout = useMemo(() => layoutWaterfall(spans), [spans]);
  const rootSpan = spans.find((span) => span.parentId === null);

  return (
    <div className="app">
      <header className="header">
        <strong>Sarathi</strong>
        <span className="trace">{state.traceId ?? "waiting for a trace…"}</span>
        <span className={`conn ${connected ? "on" : "off"}`}>
          {connected ? "live" : "offline"}
        </span>
        {rootSpan && <span className="total">{layout.totalMs.toFixed(1)} ms</span>}
      </header>

      <main className="pane">
        {layout.boxes.length === 0 ? (
          <p className="empty">
            Interact with your app — spans will appear here live.
          </p>
        ) : (
          <Waterfall layout={layout} />
        )}
      </main>

      <footer className="legend">
        <span className="done">done</span>
        <span className="running">running</span>
        <span className="waiting">waiting</span>
        <span className="failed">failed</span>
      </footer>
    </div>
  );
}
