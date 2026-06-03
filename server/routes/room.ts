import { Router } from 'express';
import { create, get, join, leave } from '../controllers/roomController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.post('/', create);
router.get('/:roomCode', get);
router.post('/:roomCode/join', join);
router.post('/:roomCode/leave', leave);

export default router;
