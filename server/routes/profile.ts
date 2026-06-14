import { Router } from 'express';
import { updateProfile } from '../controllers/profileController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.put('/', authMiddleware, updateProfile);

export default router;
