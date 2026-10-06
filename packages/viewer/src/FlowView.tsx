import type { FlowGraph, FlowNode } from "./flow";

const NODE_W = 200;
const NODE_H = 48;
const GAP_X = 60;
const GAP_Y = 28;

export interface FlowProps {
  graph: FlowGraph;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export function Flow({ graph, selectedId = null, onSelect }: FlowProps) {
  const columns: FlowNode[][] = [];
  for (const node of graph.nodes) {
    (columns[node.depth] ??= []).push(node);
  }

  const positions = new Map<string, { x: number; y: number }>();
  columns.forEach((column, depth) => {
    (column ?? []).forEach((node, index) => {
      positions.set(node.id, {
        x: 20 + depth * (NODE_W + GAP_X),
        y: 20 + index * (NODE_H + GAP_Y),
      });
    });
  });

  const maxRows = columns.reduce((max, column) => Math.max(max, column?.length ?? 0), 0);
  const width = 40 + columns.length * (NODE_W + GAP_X);
  const height = 40 + maxRows * (NODE_H + GAP_Y);

  return (
    <svg className="flow" width={width} height={height} data-testid="flow-graph">
      <defs>
        <marker id="saarthi-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L7,3 L0,6 Z" fill="#6c7086" />
        </marker>
      </defs>

      {graph.edges.map((edge) => {
        const from = positions.get(edge.from);
        const to = positions.get(edge.to);
        if (!from || !to) return null;
        const x1 = from.x + NODE_W;
        const y1 = from.y + NODE_H / 2;
        const x2 = to.x;
        const y2 = to.y + NODE_H / 2;
        const mx = (x1 + x2) / 2;
        return (
          <g
            key={edge.id}
            data-testid="flow-edge"
            data-from={edge.from}
            data-to={edge.to}
            className={`flow-edge status-${edge.status}`}
          >
            <path
              d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
              fill="none"
              stroke="#6c7086"
              markerEnd="url(#saarthi-arrow)"
            />
            <text x={mx} y={(y1 + y2) / 2 - 4} textAnchor="middle" className="edge-label">
              {edge.label}
            </text>
          </g>
        );
      })}

      {graph.nodes.map((node) => {
        const position = positions.get(node.id);
        if (!position) return null;
        const selected = selectedId === node.id;
        return (
          <g
            key={node.id}
            data-testid="flow-node"
            data-span-id={node.id}
            data-selected={selected ? "true" : "false"}
            className={`flow-node status-${node.status} ${selected ? "selected" : ""}`}
            transform={`translate(${position.x},${position.y})`}
            onClick={() => onSelect?.(node.id)}
          >
            <rect width={NODE_W} height={NODE_H} rx={6} />
            <text x={10} y={20} className="node-name">
              {node.name}
            </text>
            <text x={10} y={36} className="node-meta">
              {node.totalMs.toFixed(2)}ms · {node.status}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
