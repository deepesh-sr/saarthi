import { useEffect, useRef } from "react";
import type { WaterfallLayout } from "./layout";

const ROW_HEIGHT = 26;

export interface WaterfallProps {
  layout: WaterfallLayout;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export function Waterfall({
  layout,
  selectedId = null,
  onSelect,
}: WaterfallProps) {
  const total = layout.totalMs || 1;
  const refs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!selectedId) return;
    const element = refs.current.get(selectedId);
    element?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [selectedId]);

  return (
    <div
      className="waterfall"
      style={{ height: layout.lanes * ROW_HEIGHT + 8 }}
    >
      {layout.boxes.map((box) => {
        const selected = selectedId === box.id;
        return (
          <div
            key={box.id}
            ref={(element) => {
              if (element) refs.current.set(box.id, element);
              else refs.current.delete(box.id);
            }}
            data-testid="waterfall-box"
            data-span-id={box.id}
            data-selected={selected ? "true" : "false"}
            className={`box status-${box.status} ${selected ? "selected" : ""}`}
            style={{
              left: `${(box.x / total) * 100}%`,
              width: `${Math.max((box.width / total) * 100, 0.4)}%`,
              top: box.lane * ROW_HEIGHT,
            }}
            title={`${box.name} — ${box.totalMs.toFixed(2)}ms (self ${
              box.selfMs ?? "…"
            }) — ${box.file}:${box.line}`}
            onClick={() => onSelect?.(box.id)}
          >
            <span className="box-label">{box.name}</span>
          </div>
        );
      })}
    </div>
  );
}
