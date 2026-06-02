const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', roomController.create);
router.get('/:roomCode', roomController.get);
router.post('/:roomCode/join', roomController.join);
router.post('/:roomCode/leave', roomController.leave);

module.exports = router;
