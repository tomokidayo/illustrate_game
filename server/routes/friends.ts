import { Router } from 'express';
import { sendRequest, getFriends, getRequests, acceptRequest, deleteFriend } from '../controllers/friendsController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.post('/request', sendRequest);
router.get('/', getFriends);
router.get('/requests', getRequests);
router.put('/:id/accept', acceptRequest);
router.delete('/:id', deleteFriend);

export default router;
