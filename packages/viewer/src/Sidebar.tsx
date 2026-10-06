import type {
  Bottleneck,
  FilterMode,
  RowFilter,
  SidebarRow,
  SortKey,
} from "./analysis";

const STATUS_ICON: Record<string, string> = {
  done: "✓",
  running: "▶",
  waiting: "…",
  failed: "✕",
};

const SORT_KEYS: SortKey[] = ["self", "total", "name"];
const FILTER_MODES: FilterMode[] = ["all", "failed", "waiting", "slow"];

export interface SidebarProps {
  rows: SidebarRow[];
  totalMs: number;
  sortKey: SortKey;
  filter: RowFilter;
  selectedId: string | null;
  bottleneck: Bottleneck | null;
  onSortChange: (key: SortKey) => void;
  onFilterChange: (mode: FilterMode) => void;
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
}

export function Sidebar(props: SidebarProps) {
  const mode = props.filter.mode ?? "all";

  return (
    <aside className="sidebar">
      {props.bottleneck && (
        <div className="bottleneck" data-testid="bottleneck">
          <strong>{props.bottleneck.name}</strong> is the bottleneck —{" "}
          {props.bottleneck.percent}% of this request
        </div>
      )}

      <div className="controls">
        <div className="control-group">
          <span className="control-label">sort</span>
          {SORT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={props.sortKey === key ? "active" : ""}
              onClick={() => props.onSortChange(key)}
            >
              {key}
            </button>
          ))}
        </div>
        <div className="control-group">
          <span className="control-label">filter</span>
          {FILTER_MODES.map((value) => (
            <button
              key={value}
              type="button"
              className={mode === value ? "active" : ""}
              onClick={() => props.onFilterChange(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <input
          className="search"
          placeholder="search function…"
          value={props.filter.query ?? ""}
          onChange={(event) => props.onQueryChange(event.target.value)}
        />
      </div>

      <div className="rows">
        {props.rows.length === 0 && <p className="empty">no functions match</p>}
        {props.rows.map((row) => {
          const selected = props.selectedId === row.id;
          return (
            <button
              key={row.id}
              type="button"
              data-testid="sidebar-row"
              data-span-id={row.id}
              data-selected={selected ? "true" : "false"}
              className={`row status-${row.status} ${selected ? "selected" : ""}`}
              style={{ paddingLeft: 8 + row.depth * 12 }}
              title={`${row.name} — self ${row.selfMs ?? "…"}ms / total ${row.totalMs}ms`}
              onClick={() => props.onSelect(row.id)}
            >
              <span className="icon">{STATUS_ICON[row.status] ?? "•"}</span>
              <span className="row-name">{row.name}</span>
              <span className="row-ms">{row.selfMs === null ? "…" : `${row.selfMs}ms`}</span>
              <span className="row-total">{row.totalMs}ms</span>
              <span className="row-file">
                {row.file}:{row.line}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
