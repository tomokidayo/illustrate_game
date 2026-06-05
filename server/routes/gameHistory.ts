import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { getGameHistories } from '../controllers/gameHistoryController';

const router = Router();

router.get('/', authMiddleware, getGameHistories);

export default router;
