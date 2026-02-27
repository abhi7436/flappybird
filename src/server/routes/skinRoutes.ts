import { Router, Request, Response } from 'express';
import { requireAuth as authenticate } from '../middleware/authMiddleware';
import { SkinRepository } from '../repositories/SkinRepository';

const router = Router();

/** GET /api/skins — all skins with ownership status for authenticated user */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const skins = await SkinRepository.getAllWithOwnership(req.user!.userId);
    res.json({ skins });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch skins' });
  }
});

/** POST /api/skins/:skinId/equip — equip an owned skin */
router.post('/:skinId/equip', authenticate, async (req: Request, res: Response) => {
  try {
    await SkinRepository.equip(req.user!.userId, req.params.skinId);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'SKIN_NOT_OWNED') {
      return res.status(403).json({ error: 'You do not own this skin' });
    }
    res.status(500).json({ error: 'Failed to equip skin' });
  }
});

/** GET /api/skins/equipped — returns the currently equipped skin */
router.get('/equipped', authenticate, async (req: Request, res: Response) => {
  try {
    const skinId = await SkinRepository.getEquipped(req.user!.userId);
    const skin   = await SkinRepository.getById(skinId);
    res.json({ skin });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch equipped skin' });
  }
});

export default router;
