import { useState } from "react";
import {
  X,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Globe,
  Link2,
  Activity,
  ShieldAlert,
} from "lucide-react";
import type { ImpactAnalysis, GraphNode } from "@shared/types";

interface AnalysisPanelProps {
  data: ImpactAnalysis | null;
  open: boolean;
  onClose: () => void;
  onNodeClick: (id: string) => void;
  allNodes: GraphNode[];
}

const anomalyLabel: Record<string, string> = {
  cycle: "循环引用",
  orphan: "孤立节点",
  broken: "断链引用",
};

const riskTag: Record<string, string> = {
  low: "tag-green",
  medium: "tag-orange",
  high: "tag-red",
};

const riskLabel: Record<string, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

const actionTag: Record<string, string> = {
  update: "tag-blue",
  delete: "tag-red",
  redirect: "tag-orange",
};

const actionLabel: Record<string, string> = {
  update: "更新",
  delete: "删除",
  redirect: "重定向",
};

function findNode(nodes: GraphNode[], id: string): GraphNode | undefined {
  return nodes.find((n) => n.id === id);
}

export default function AnalysisPanel({
  data,
  open,
  onClose,
  onNodeClick,
  allNodes,
}: AnalysisPanelProps) {
  const [pathsExpanded, setPathsExpanded] = useState(false);

  if (!data) return null;

  const { node, upstreamIds, downstreamIds, allUpstreamIds, allDownstreamIds, cascadePaths, suggestions } = data;
  const displayPaths = pathsExpanded ? cascadePaths : cascadePaths.slice(0, 5);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-[400px] z-50 bg-dark-900/95 backdrop-blur border-l border-dark-700 shadow-glow transform transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        } overflow-y-auto`}
      >
        <div className="p-5">
          <div className="flex items-start justify-between mb-5">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{node.name}</h2>
              <p className="text-dark-400 text-sm mt-0.5 font-mono">{node.shortCode}</p>
            </div>
            <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>

          {node.anomalyType && (
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-warning-500" />
              <span className="tag-orange">{anomalyLabel[node.anomalyType] ?? node.anomalyType}</span>
            </div>
          )}

          <div className="card p-4 mb-4">
            <h3 className="text-sm font-semibold text-dark-300 mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-brand-400" />
              节点信息
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-400">目标地址</span>
                <span className="text-dark-100 truncate max-w-[220px]" title={node.targetUrl}>{node.targetUrl}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">类型</span>
                <span className={node.type === "dynamic" ? "tag-blue" : "tag-gray"}>
                  {node.type === "dynamic" ? "动态" : "静态"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">状态</span>
                <span className={node.enabled ? "tag-green" : "tag-red"}>
                  {node.enabled ? "已启用" : "已禁用"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">扫描次数</span>
                <span className="text-dark-100">{node.scanCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">入度 / 出度</span>
                <span className="text-dark-100">{node.indegree} / {node.outdegree}</span>
              </div>
            </div>
          </div>

          <div className="card p-4 mb-4">
            <h3 className="text-sm font-semibold text-dark-300 mb-3 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-accent-400" />
              依赖链
            </h3>
            <div className="mb-3">
              <p className="text-xs text-dark-400 mb-1.5 flex items-center gap-1">
                <ArrowUp className="w-3 h-3" /> 上游节点 ({upstreamIds.length})
              </p>
              {upstreamIds.length === 0 && <p className="text-xs text-dark-500 pl-4">无上游依赖</p>}
              <div className="space-y-1">
                {upstreamIds.map((id) => {
                  const n = findNode(allNodes, id);
                  return (
                    <div
                      key={id}
                      onClick={() => onNodeClick(id)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-800/60 hover:bg-dark-700 cursor-pointer transition-colors text-sm"
                    >
                      <span className="text-dark-100 truncate">{n?.name ?? id}</span>
                      {n?.anomalyType && <AlertTriangle className="w-3 h-3 text-warning-500 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-xs text-dark-400 mb-1.5 flex items-center gap-1">
                <ArrowDown className="w-3 h-3" /> 下游节点 ({downstreamIds.length})
              </p>
              {downstreamIds.length === 0 && <p className="text-xs text-dark-500 pl-4">无下游依赖</p>}
              <div className="space-y-1">
                {downstreamIds.map((id) => {
                  const n = findNode(allNodes, id);
                  return (
                    <div
                      key={id}
                      onClick={() => onNodeClick(id)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-800/60 hover:bg-dark-700 cursor-pointer transition-colors text-sm"
                    >
                      <span className="text-dark-100 truncate">{n?.name ?? id}</span>
                      {n?.anomalyType && <AlertTriangle className="w-3 h-3 text-warning-500 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="card p-4 mb-4">
            <h3 className="text-sm font-semibold text-dark-300 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-warning-500" />
              影响范围
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-dark-800/60 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-brand-400">{allUpstreamIds.length}</p>
                <p className="text-xs text-dark-400 mt-1">全部上游</p>
              </div>
              <div className="bg-dark-800/60 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-accent-400">{allDownstreamIds.length}</p>
                <p className="text-xs text-dark-400 mt-1">全部下游</p>
              </div>
            </div>
            {cascadePaths.length > 0 && (
              <>
                <p className="text-xs text-dark-400 mb-1.5">级联路径 ({cascadePaths.length})</p>
                <div className="space-y-1">
                  {displayPaths.map((path, i) => (
                    <div key={i} className="text-xs text-dark-200 bg-dark-800/60 rounded-lg px-3 py-1.5 font-mono truncate" title={path.join(" → ")}>
                      {path.map((id, j) => {
                        const n = findNode(allNodes, id);
                        return (
                          <span key={j}>
                            {j > 0 && <span className="text-dark-500 mx-0.5">→</span>}
                            <span
                              className="text-brand-300 hover:text-brand-200 cursor-pointer"
                              onClick={() => onNodeClick(id)}
                            >
                              {n?.name ?? id}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {cascadePaths.length > 5 && (
                  <button
                    onClick={() => setPathsExpanded(!pathsExpanded)}
                    className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-2 transition-colors"
                  >
                    {pathsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {pathsExpanded ? "收起" : `展开全部 (${cascadePaths.length})`}
                  </button>
                )}
              </>
            )}
          </div>

          {suggestions.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-dark-300 mb-3 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-danger-500" />
                级联建议
              </h3>
              <div className="space-y-3">
                {suggestions.map((s, i) => (
                  <div key={i} className="bg-dark-800/60 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={riskTag[s.risk]}>{riskLabel[s.risk]}</span>
                      <span className={actionTag[s.type]}>{actionLabel[s.type]}</span>
                    </div>
                    <p className="text-sm text-dark-200">{s.description}</p>
                    <p className="text-xs text-dark-500 mt-1">影响 {s.affectedIds.length} 个节点</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
