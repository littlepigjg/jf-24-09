import { AlertTriangle, Unplug, Unlink, GitBranch } from "lucide-react";
import type { DependencyGraph } from "@shared/types";

interface AnomalyBarProps {
  graph: DependencyGraph | null;
  filterAnomaly: string | null;
  onFilterChange: (type: string | null) => void;
}

const cards = [
  { key: "cycle", label: "循环引用", icon: AlertTriangle, gradient: "from-danger-500 to-danger-600", field: "cycles" as const },
  { key: "orphan", label: "孤立节点", icon: Unplug, gradient: "from-dark-400 to-dark-600", field: "orphanIds" as const },
  { key: "broken", label: "断链引用", icon: Unlink, gradient: "from-warning-500 to-warning-600", field: "brokenEdges" as const },
  { key: "edges", label: "依赖关系", icon: GitBranch, gradient: "from-brand-500 to-accent-500", field: "edges" as const },
];

function getCount(graph: DependencyGraph | null, field: typeof cards[number]["field"]): number | string {
  if (!graph) return "—";
  const val = graph[field];
  return Array.isArray(val) ? val.length : "—";
}

export default function AnomalyBar({ graph, filterAnomaly, onFilterChange }: AnomalyBarProps) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((c, i) => {
        const active = filterAnomaly === c.key;
        return (
          <div
            key={c.key}
            onClick={() => onFilterChange(active ? null : c.key)}
            className={`stat-card animate-fade-up cursor-pointer select-none ${
              active ? "ring-2 ring-brand-400 border-brand-500/60" : ""
            }`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="relative z-10">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-dark-400 text-sm">{c.label}</p>
                  <p className="text-3xl font-display font-bold text-white mt-2 animate-count-up">
                    {getCount(graph, c.field)}
                  </p>
                </div>
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-glow-sm`}>
                  <c.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
