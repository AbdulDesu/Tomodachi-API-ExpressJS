import { Router } from 'express';
import { processSwipe } from '../controllers/swipe.controller.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.post('/', verifyToken, processSwipe);

export default router;