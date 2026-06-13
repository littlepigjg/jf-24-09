import { useRef, useEffect, useCallback } from 'react'
import type { GraphNode, GraphEdge } from '@shared/types'

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodeClick: (id: string) => void
  selectedNodeId?: string
  filterAnomaly?: string | null
}

interface SimNode {
  id: string
  name: string
  anomalyType?: 'cycle' | 'orphan' | 'broken'
  x: number
  y: number
  vx: number
  vy: number
}

const REPULSION = 5000
const ATTRACTION = 0.005
const CENTERING = 0.01
const DAMPING = 0.85
const NW = 120
const NH = 40
const NR = 8

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

export default function GraphCanvas({ nodes, edges, onNodeClick, selectedNodeId, filterAnomaly }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<{ nodes: SimNode[]; edges: GraphEdge[]; nodeMap: Map<string, SimNode>; alpha: number }>({
    nodes: [], edges: [], nodeMap: new Map(), alpha: 1,
  })
  const tfRef = useRef({ x: 0, y: 0, scale: 1 })
  const dragRef = useRef<{ nodeId: string | null; sx: number; sy: number; pan: boolean }>({
    nodeId: null, sx: 0, sy: 0, pan: false,
  })
  const rafRef = useRef(0)
  const dotPatternRef = useRef<CanvasPattern | null>(null)

  const getVisible = useCallback(() => {
    let filtered = nodes
    if (filterAnomaly) {
      const matchIds = new Set(nodes.filter(n => n.anomalyType === filterAnomaly).map(n => n.id))
      const connIds = new Set(matchIds)
      edges.forEach(e => {
        if (matchIds.has(e.source)) connIds.add(e.target)
        if (matchIds.has(e.target)) connIds.add(e.source)
      })
      filtered = nodes.filter(n => connIds.has(n.id))
    }
    const ids = new Set(filtered.map(n => n.id))
    return { filtered, filteredEdges: edges.filter(e => ids.has(e.source) && ids.has(e.target)) }
  }, [nodes, edges, filterAnomaly])

  useEffect(() => {
    const { filtered, filteredEdges } = getVisible()
    const prev = new Map(simRef.current.nodes.map(n => [n.id, n]))
    const simNodes: SimNode[] = filtered.map(n => {
      const p = prev.get(n.id)
      return {
        id: n.id, name: n.name, anomalyType: n.anomalyType,
        x: p?.x ?? (Math.random() - 0.5) * 400, y: p?.y ?? (Math.random() - 0.5) * 300,
        vx: 0, vy: 0,
      }
    })
    simRef.current = { nodes: simNodes, edges: filteredEdges, nodeMap: new Map(simNodes.map(n => [n.id, n])), alpha: 1 }
  }, [getVisible])

  const createDotPattern = useCallback((ctx: CanvasRenderingContext2D) => {
    const c = document.createElement('canvas')
    c.width = 10; c.height = 10
    const dc = c.getContext('2d')!
    dc.fillStyle = 'rgba(148,163,184,0.15)'
    dc.beginPath(); dc.arc(5, 5, 0.7, 0, Math.PI * 2); dc.fill()
    dotPatternRef.current = ctx.createPattern(c, 'repeat')
  }, [])

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const { nodes: sns, edges: ses, nodeMap } = simRef.current
    const tf = tfRef.current
    const dpr = window.devicePixelRatio || 1

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (dotPatternRef.current) {
      ctx.fillStyle = dotPatternRef.current
      ctx.fillRect(0, 0, w, h)
    }

    ctx.save()
    ctx.translate(w / 2 + tf.x, h / 2 + tf.y)
    ctx.scale(tf.scale, tf.scale)

    ses.forEach(e => {
      const s = nodeMap.get(e.source), tg = nodeMap.get(e.target)
      if (!s || !tg) return
      const dx = tg.x - s.x, dy = tg.y - s.y
      const cx = (s.x + tg.x) / 2 - dy * 0.15, cy = (s.y + tg.y) / 2 + dx * 0.15
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.quadraticCurveTo(cx, cy, tg.x, tg.y)
      if (e.broken) { ctx.strokeStyle = '#FA8C16'; ctx.setLineDash([6, 4]) }
      else { ctx.strokeStyle = 'rgba(148,163,184,0.35)'; ctx.setLineDash([]) }
      ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([])

      const u = 0.85
      const px = (1 - u) ** 2 * s.x + 2 * (1 - u) * u * cx + u ** 2 * tg.x
      const py = (1 - u) ** 2 * s.y + 2 * (1 - u) * u * cy + u ** 2 * tg.y
      const v = u + 0.01
      const qx = (1 - v) ** 2 * s.x + 2 * (1 - v) * v * cx + v ** 2 * tg.x
      const qy = (1 - v) ** 2 * s.y + 2 * (1 - v) * v * cy + v ** 2 * tg.y
      const ang = Math.atan2(qy - py, qx - px)
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px - 8 * Math.cos(ang - 0.35), py - 8 * Math.sin(ang - 0.35))
      ctx.moveTo(px, py)
      ctx.lineTo(px - 8 * Math.cos(ang + 0.35), py - 8 * Math.sin(ang + 0.35))
      ctx.strokeStyle = e.broken ? '#FA8C16' : 'rgba(148,163,184,0.5)'
      ctx.lineWidth = 1.5; ctx.stroke()
    })

    sns.forEach(n => {
      const hw = NW / 2, hh = NH / 2
      if (n.id === selectedNodeId) {
        ctx.shadowColor = '#1677FF'; ctx.shadowBlur = 20
        ctx.beginPath(); roundRect(ctx, n.x - hw - 3, n.y - hh - 3, NW + 6, NH + 6, NR + 2)
        ctx.strokeStyle = '#3898FF'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.shadowBlur = 0
      }
      if (n.anomalyType === 'cycle') {
        const p = 0.5 + 0.5 * Math.sin(t * 0.004)
        ctx.shadowColor = '#FF4D4F'; ctx.shadowBlur = 12 + 8 * p
      }
      ctx.beginPath(); roundRect(ctx, n.x - hw, n.y - hh, NW, NH, NR)
      if (n.anomalyType === 'orphan') ctx.fillStyle = '#64748B'
      else if (n.anomalyType === 'broken' || n.anomalyType === 'cycle') ctx.fillStyle = '#1E293B'
      else {
        const g = ctx.createLinearGradient(n.x - hw, n.y, n.x + hw, n.y)
        g.addColorStop(0, '#1677FF'); g.addColorStop(1, '#00B8D9'); ctx.fillStyle = g
      }
      ctx.fill(); ctx.shadowBlur = 0

      ctx.beginPath(); roundRect(ctx, n.x - hw, n.y - hh, NW, NH, NR)
      if (n.anomalyType === 'cycle') { ctx.strokeStyle = '#FF4D4F'; ctx.lineWidth = 2 }
      else if (n.anomalyType === 'broken') { ctx.strokeStyle = '#FA8C16'; ctx.lineWidth = 2 }
      else if (n.anomalyType === 'orphan') { ctx.strokeStyle = '#475569'; ctx.lineWidth = 1 }
      else { ctx.strokeStyle = 'rgba(22,119,255,0.5)'; ctx.lineWidth = 1 }
      ctx.stroke()

      ctx.fillStyle = '#E2E8F0'
      ctx.font = '12px "PingFang SC","Microsoft YaHei",sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(n.name.length > 8 ? n.name.slice(0, 8) + '…' : n.name, n.x, n.y)
    })
    ctx.restore()
  }, [selectedNodeId])

  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')!
    let running = true, cw = 0, ch = 0

    createDotPattern(ctx)

    const resize = () => {
      const r = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      cw = r.width; ch = r.height
      canvas.width = cw * dpr; canvas.height = ch * dpr
      canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px'
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(container)

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      tfRef.current.scale = Math.max(0.2, Math.min(5, tfRef.current.scale * (e.deltaY > 0 ? 0.9 : 1.1)))
      simRef.current.alpha = Math.max(simRef.current.alpha, 0.01)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })

    const tick = () => {
      const sim = simRef.current
      if (sim.alpha >= 0.001) {
        sim.alpha *= 0.995
        const { nodes: sns, edges: ses, nodeMap } = sim
        for (let i = 0; i < sns.length; i++) {
          for (let j = i + 1; j < sns.length; j++) {
            const dx = sns[j].x - sns[i].x, dy = sns[j].y - sns[i].y
            const d2 = dx * dx + dy * dy || 1
            const dist = Math.sqrt(d2)
            const f = REPULSION * sim.alpha / d2
            const fx = (dx / dist) * f, fy = (dy / dist) * f
            sns[i].vx -= fx; sns[i].vy -= fy; sns[j].vx += fx; sns[j].vy += fy
          }
        }
        ses.forEach(e => {
          const s = nodeMap.get(e.source), t = nodeMap.get(e.target)
          if (!s || !t) return
          const dx = t.x - s.x, dy = t.y - s.y, dist = Math.sqrt(dx * dx + dy * dy) || 1
          const f = ATTRACTION * dist * sim.alpha
          s.vx += (dx / dist) * f; s.vy += (dy / dist) * f
          t.vx -= (dx / dist) * f; t.vy -= (dy / dist) * f
        })
        sns.forEach(n => {
          n.vx -= CENTERING * n.x * sim.alpha; n.vy -= CENTERING * n.y * sim.alpha
          n.vx *= DAMPING; n.vy *= DAMPING; n.x += n.vx; n.y += n.vy
        })
      }
      draw(ctx, cw, ch, performance.now())
      if (running) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      running = false; cancelAnimationFrame(rafRef.current); ro.disconnect()
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [draw, createDotPattern])

  const s2w = useCallback((sx: number, sy: number) => {
    const r = canvasRef.current!.getBoundingClientRect()
    const tf = tfRef.current
    return { x: (sx - r.left - r.width / 2 - tf.x) / tf.scale, y: (sy - r.top - r.height / 2 - tf.y) / tf.scale }
  }, [])

  const hitNode = useCallback((wx: number, wy: number) =>
    simRef.current.nodes.find(n => Math.abs(wx - n.x) < NW / 2 && Math.abs(wy - n.y) < NH / 2), [])

  const onDown = useCallback((e: React.MouseEvent) => {
    const { x, y } = s2w(e.clientX, e.clientY)
    const hit = hitNode(x, y)
    dragRef.current = hit
      ? { nodeId: hit.id, sx: e.clientX, sy: e.clientY, pan: false }
      : { nodeId: null, sx: e.clientX, sy: e.clientY, pan: true }
  }, [s2w, hitNode])

  const onMove = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current
    if (d.pan) {
      tfRef.current.x += e.clientX - d.sx; tfRef.current.y += e.clientY - d.sy
      d.sx = e.clientX; d.sy = e.clientY
    } else if (d.nodeId) {
      const n = simRef.current.nodeMap.get(d.nodeId)
      if (n) { const { x, y } = s2w(e.clientX, e.clientY); n.x = x; n.y = y; n.vx = 0; n.vy = 0 }
    }
  }, [s2w])

  const onUp = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current
    if (d.nodeId && !d.pan && Math.abs(e.clientX - d.sx) < 4 && Math.abs(e.clientY - d.sy) < 4) onNodeClick(d.nodeId)
    dragRef.current = { nodeId: null, sx: 0, sy: 0, pan: false }
  }, [onNodeClick])

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} />
    </div>
  )
}
