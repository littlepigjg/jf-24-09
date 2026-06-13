import { useEffect, useState, useCallback } from "react";
import { RefreshCw, ZoomIn, ZoomOut, Maximize2, Search } from "lucide-react";
import GraphCanvas from "@/components/GraphCanvas";
import AnomalyBar from "@/components/AnomalyBar";
import AnalysisPanel from "@/components/AnalysisPanel";
import Empty from "@/components/Empty";
import { api } from "@/lib/api";
import type { DependencyGraph, ImpactAnalysis } from "@shared/types";

export default function DependencyGraph() {
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [impactData, setImpactData] = useState<ImpactAnalysis | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [filterAnomaly, setFilterAnomaly] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDependencyGraph();
      setGraph(data);
    } catch (err) {
      console.error("加载依赖图失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const handleNodeClick = useCallback(async (id: string) => {
    setSelectedNodeId(id);
    setPanelOpen(true);
    try {
      const data = await api.getImpactAnalysis(id);
      setImpactData(data);
    } catch (err) {
      console.error("加载影响分析失败:", err);
    }
  }, []);

  const handleFilterChange = useCallback((type: string | null) => {
    setFilterAnomaly(type);
  }, []);

  const handleClosePanel = useCallback(() => {
    setPanelOpen(false);
    setSelectedNodeId(undefined);
    setImpactData(null);
  }, []);

  const filteredNodes = graph?.nodes.filter((n) =>
    searchKeyword
      ? n.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        n.shortCode.toLowerCase().includes(searchKeyword.toLowerCase())
      : true
  ) || [];

  const filteredEdges = graph?.edges.filter((e) => {
    if (!searchKeyword) return true;
    const sourceNode = graph.nodes.find((n) => n.id === e.source);
    const targetNode = graph.nodes.find((n) => n.id === e.target);
    return sourceNode && targetNode;
  }) || [];

  const displayGraph = searchKeyword
    ? { ...graph!, nodes: filteredNodes, edges: filteredEdges }
    : graph;

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">依赖关系图谱</h1>
          <p className="text-dark-400 mt-1 text-sm">
            可视化分析二维码之间的引用关系，识别循环引用、孤立节点等异常
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
            <input
              type="text"
              placeholder="搜索二维码..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="input pl-9 py-2 text-sm w-48"
            />
          </div>
          <button onClick={loadGraph} className="btn-secondary" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>

      <AnomalyBar
        graph={graph}
        filterAnomaly={filterAnomaly}
        onFilterChange={handleFilterChange}
      />

      <div className="flex-1 card p-4 relative min-h-[500px]">
        <div className="absolute top-6 right-6 z-10 flex flex-col gap-2">
          <button
            onClick={() => {
              const canvas = document.querySelector("canvas");
              if (canvas) {
                const event = new WheelEvent("wheel", { deltaY: -100 });
                canvas.dispatchEvent(event);
              }
            }}
            className="btn-ghost p-2 bg-dark-800/80 backdrop-blur border border-dark-700"
            title="放大"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const canvas = document.querySelector("canvas");
              if (canvas) {
                const event = new WheelEvent("wheel", { deltaY: 100 });
                canvas.dispatchEvent(event);
              }
            }}
            className="btn-ghost p-2 bg-dark-800/80 backdrop-blur border border-dark-700"
            title="缩小"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.location.reload()}
            className="btn-ghost p-2 bg-dark-800/80 backdrop-blur border border-dark-700"
            title="重置视图"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-brand-400 animate-spin mx-auto mb-3" />
              <p className="text-dark-400 text-sm">正在构建依赖关系图...</p>
            </div>
          </div>
        ) : graph && graph.nodes.length > 0 ? (
          <GraphCanvas
            nodes={displayGraph?.nodes || []}
            edges={displayGraph?.edges || []}
            onNodeClick={handleNodeClick}
            selectedNodeId={selectedNodeId}
            filterAnomaly={filterAnomaly}
          />
        ) : (
          <Empty
            title="暂无依赖数据"
            description="创建更多二维码后，系统将自动分析它们之间的引用关系"
          />
        )}
      </div>

      <AnalysisPanel
        data={impactData}
        open={panelOpen}
        onClose={handleClosePanel}
        onNodeClick={handleNodeClick}
        allNodes={graph?.nodes || []}
      />
    </div>
  );
}
