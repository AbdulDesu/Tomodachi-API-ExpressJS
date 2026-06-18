import { Router } from 'express';
import {getChatHistory, getChatList, uploadMediaMessage} from '../controllers/chat.controller.js';
import { verifyToken } from '../middleware/auth.js';
import {uploadPhoto} from "../middleware/upload.js";

const router = Router();

router.get('/inbox', verifyToken, getChatList);
router.get('/:conversationId/messages', verifyToken, getChatHistory);
router.post('/upload-media', verifyToken, uploadPhoto.single('media'), uploadMediaMessage);

export default router;