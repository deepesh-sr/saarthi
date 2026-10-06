import type { WaterfallLayout } from "./layout";

const ROW_HEIGHT = 26;

export function Waterfall({ layout }: { layout: WaterfallLayout }) {
  const total = layout.totalMs || 1;

  return (
    <div
      className="waterfall"
      style={{ height: layout.lanes * ROW_HEIGHT + 8 }}
    >
      {layout.boxes.map((box) => (
        <div
          key={box.id}
          className={`box status-${box.status}`}
          style={{
            left: `${(box.x / total) * 100}%`,
            width: `${Math.max((box.width / total) * 100, 0.4)}%`,
            top: box.lane * ROW_HEIGHT,
          }}
          title={`${box.name} — ${box.totalMs.toFixed(2)}ms (self ${
            box.selfMs ?? "…"
          }) — ${box.file}:${box.line}`}
        >
          <span className="box-label">{box.name}</span>
        </div>
      ))}
    </div>
  );
}
