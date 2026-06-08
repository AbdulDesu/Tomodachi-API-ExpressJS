import { Router } from 'express';
import { getNearbyProfiles } from '../controllers/discover.controller.js';
import { verifyToken } from '../middleware/auth.js';
import { handleErrorAsync } from '../helper/api.js';

const router = Router();

router.get('/nearby', verifyToken, getNearbyProfiles);

export default router;