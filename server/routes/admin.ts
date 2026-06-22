import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { adminMiddleware } from '../middleware/adminMiddleware';
import { getUsers } from '../controllers/adminController';

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get('/users', getUsers);

export default router;
