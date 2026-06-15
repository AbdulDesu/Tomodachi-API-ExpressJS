import { Router } from 'express';
import {getNearbyProfiles, processSwipe} from '../controllers/discover.controller.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.get('/nearby', verifyToken, getNearbyProfiles);
router.post('/swipe', verifyToken, processSwipe);

export default router;