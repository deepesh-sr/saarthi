import { useEffect, useState } from "react";
import type { SpanEvent, Trace } from "@saarthi/core";
import { applyEvent, createTraceState, mergeTrace, spansInOrder } from "./reducer";
import { TraceView } from "./TraceView";

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

  return (
    <TraceView
      spans={spansInOrder(state)}
      traceId={state.traceId}
      connected={connected}
    />
  );
}
