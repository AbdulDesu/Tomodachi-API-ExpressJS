import { Router } from 'express';
import { processSwipe } from '../controllers/swipe.controller.js';
import { verifyToken } from '../middleware/auth.js';
import { handleErrorAsync } from '../helper/api.js';

const router = Router();

router.post('/', verifyToken, handleErrorAsync(processSwipe));

export default router;