import { Router, type Request, type Response } from 'express'
import { DependencyService } from '../services/DependencyService.js'

const router = Router()

router.get('/graph', async (_req: Request, res: Response): Promise<void> => {
  try {
    const graph = await DependencyService.buildGraph()
    res.json({ success: true, data: graph })
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})

router.get('/impact/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const impact = await DependencyService.getImpact(req.params.id)
    if (!impact) {
      res.status(404).json({ success: false, error: 'Node not found' })
      return
    }
    res.json({ success: true, data: impact })
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})

export default router
