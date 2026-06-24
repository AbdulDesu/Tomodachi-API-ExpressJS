import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import {generateCallToken} from "../controllers/call.controller.js";


const router = Router();

router.get('/token/:conversationId', verifyToken, generateCallToken);

export default router;