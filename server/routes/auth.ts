import { Router } from 'express';
import { register, login, logout, me, guestLogin } from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/guest', guestLogin);
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, me);

export default router;
