import { qrCodeRepository } from '../repositories/QrCodeRepository.js'
import type { QrCode, GraphNode, GraphEdge, DependencyGraph, ImpactAnalysis, CascadeSuggestion } from '../../shared/types.js'

const SHORT_CODE_PATTERN = /\/r\/([a-zA-Z0-9]+)/

function extractShortCode(url: string): string | null {
  const match = url.match(SHORT_CODE_PATTERN)
  return match ? match[1] : null
}

function tarjanSCC(adj: Map<string, string[]>): string[][] {
  const indexMap = new Map<string, number>()
  const lowLink = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const result: string[][] = []
  let index = 0

  function strongconnect(v: string) {
    indexMap.set(v, index)
    lowLink.set(v, index)
    index++
    stack.push(v)
    onStack.add(v)

    const neighbors = adj.get(v) || []
    for (const w of neighbors) {
      if (!indexMap.has(w)) {
        strongconnect(w)
        lowLink.set(v, Math.min(lowLink.get(v)!, lowLink.get(w)!))
      } else if (onStack.has(w)) {
        lowLink.set(v, Math.min(lowLink.get(v)!, indexMap.get(w)!))
      }
    }

    if (lowLink.get(v) === indexMap.get(v)) {
      const component: string[] = []
      let w: string
      do {
        w = stack.pop()!
        onStack.delete(w)
        component.push(w)
      } while (w !== v)
      if (component.length > 1) {
        result.push(component)
      }
    }
  }

  for (const v of adj.keys()) {
    if (!indexMap.has(v)) {
      strongconnect(v)
    }
  }

  return result
}

export const DependencyService = {
  async buildGraph(): Promise<DependencyGraph> {
    const qrcodes = await qrCodeRepository.getAll()

    const shortCodeToId = new Map<string, string>()
    for (const qr of qrcodes) {
      shortCodeToId.set(qr.shortCode, qr.id)
    }

    const edges: GraphEdge[] = []
    const adjacency = new Map<string, string[]>()
    const reverseAdj = new Map<string, string[]>()
    const outdegree = new Map<string, number>()
    const indegree = new Map<string, number>()
    const brokenEdges: GraphEdge[] = []
    const cycleNodeIds = new Set<string>()
    const orphanIds: string[] = []

    for (const qr of qrcodes) {
      adjacency.set(qr.id, [])
      reverseAdj.set(qr.id, [])
      outdegree.set(qr.id, 0)
      indegree.set(qr.id, 0)
    }

    for (const qr of qrcodes) {
      const targetShortCode = extractShortCode(qr.targetUrl)
      if (!targetShortCode) continue

      const targetId = shortCodeToId.get(targetShortCode)
      const edge: GraphEdge = {
        source: qr.id,
        target: targetId || targetShortCode,
        broken: !targetId,
      }

      edges.push(edge)
      if (edge.broken) {
        brokenEdges.push(edge)
      }

      if (targetId) {
        adjacency.get(qr.id)!.push(targetId)
        reverseAdj.get(targetId)!.push(qr.id)
        outdegree.set(qr.id, (outdegree.get(qr.id) || 0) + 1)
        indegree.set(targetId, (indegree.get(targetId) || 0) + 1)
      }
    }

    const cycles = tarjanSCC(adjacency)
    for (const cycle of cycles) {
      for (const id of cycle) {
        cycleNodeIds.add(id)
      }
    }

    for (const qr of qrcodes) {
      const od = outdegree.get(qr.id) || 0
      const ind = indegree.get(qr.id) || 0
      if (od === 0 && ind === 0) {
        orphanIds.push(qr.id)
      }
    }

    const nodes: GraphNode[] = qrcodes.map((qr) => {
      const od = outdegree.get(qr.id) || 0
      const ind = indegree.get(qr.id) || 0
      let anomalyType: GraphNode['anomalyType']
      if (cycleNodeIds.has(qr.id)) {
        anomalyType = 'cycle'
      } else if (od === 0 && ind === 0) {
        anomalyType = 'orphan'
      }

      const brokenEdge = brokenEdges.find((e) => e.source === qr.id)
      if (brokenEdge && !anomalyType) {
        anomalyType = 'broken'
      }

      return {
        id: qr.id,
        name: qr.name,
        shortCode: qr.shortCode,
        targetUrl: qr.targetUrl,
        type: qr.type,
        enabled: qr.enabled,
        scanCount: qr.scanCount,
        indegree: ind,
        outdegree: od,
        anomalyType,
      }
    })

    return { nodes, edges, cycles, orphanIds, brokenEdges }
  },

  async getImpact(id: string): Promise<ImpactAnalysis | null> {
    const graph = await DependencyService.buildGraph()
    const node = graph.nodes.find((n) => n.id === id)
    if (!node) return null

    const adjacency = new Map<string, string[]>()
    const reverseAdj = new Map<string, string[]>()
    for (const n of graph.nodes) {
      adjacency.set(n.id, [])
      reverseAdj.set(n.id, [])
    }
    for (const e of graph.edges) {
      if (!e.broken) {
        adjacency.get(e.source)?.push(e.target)
        reverseAdj.get(e.target)?.push(e.source)
      }
    }

    const downstreamIds: string[] = adjacency.get(id) || []
    const upstreamIds: string[] = reverseAdj.get(id) || []

    const allDownstreamIds = bfs(id, adjacency)
    const allUpstreamIds = bfs(id, reverseAdj)

    const cascadePaths = findAllPaths(id, adjacency, 10)

    const suggestions: CascadeSuggestion[] = []

    if (allDownstreamIds.length > 0) {
      suggestions.push({
        type: 'update',
        affectedIds: allDownstreamIds,
        description: `修改此二维码将级联影响 ${allDownstreamIds.length} 个下游二维码，请同步更新其目标URL`,
        risk: allDownstreamIds.length > 5 ? 'high' : allDownstreamIds.length > 2 ? 'medium' : 'low',
      })
    }

    if (allUpstreamIds.length > 0) {
      suggestions.push({
        type: 'redirect',
        affectedIds: allUpstreamIds,
        description: `删除此二维码将导致 ${allUpstreamIds.length} 个上游二维码的跳转失效，建议设置重定向`,
        risk: allUpstreamIds.length > 3 ? 'high' : allUpstreamIds.length > 1 ? 'medium' : 'low',
      })
    }

    if (node.anomalyType === 'cycle') {
      const cycleGroup = graph.cycles.find((c) => c.includes(id))
      if (cycleGroup) {
        suggestions.push({
          type: 'delete',
          affectedIds: cycleGroup,
          description: `此二维码参与循环引用（链路长度 ${cycleGroup.length}），建议打破循环链路`,
          risk: 'high',
        })
      }
    }

    if (node.anomalyType === 'orphan') {
      suggestions.push({
        type: 'delete',
        affectedIds: [id],
        description: '此二维码无任何依赖关系，属于孤立节点，可考虑清理',
        risk: 'low',
      })
    }

    return {
      node,
      upstreamIds,
      downstreamIds,
      allDownstreamIds,
      allUpstreamIds,
      cascadePaths,
      suggestions,
    }
  },
}

function bfs(start: string, adj: Map<string, string[]>): string[] {
  const visited = new Set<string>()
  const queue: string[] = [start]
  visited.add(start)
  const result: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    const neighbors = adj.get(current) || []
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push(next)
        result.push(next)
      }
    }
  }
  return result
}

function findAllPaths(start: string, adj: Map<string, string[]>, maxDepth: number): string[][] {
  const paths: string[][] = []
  const visited = new Set<string>()

  function dfs(current: string, path: string[]) {
    if (path.length > maxDepth) return
    if (path.length > 1) {
      paths.push([...path])
    }
    visited.add(current)
    const neighbors = adj.get(current) || []
    for (const next of neighbors) {
      if (!visited.has(next)) {
        path.push(next)
        dfs(next, path)
        path.pop()
      }
    }
    visited.delete(current)
  }

  dfs(start, [start])
  return paths.slice(0, 50)
}
