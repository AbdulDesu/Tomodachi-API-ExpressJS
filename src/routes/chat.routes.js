import { Router } from 'express';
import {getChatHistory, getChatList, uploadMediaMessage} from '../controllers/chat.controller.js';
import { verifyToken } from '../middleware/auth.js';
import {handleErrorAsync} from "../helper/api.js";
import {uploadPhoto} from "../middleware/upload.js";

const router = Router();

router.get('/inbox', verifyToken, handleErrorAsync(getChatList()));
router.get('/:conversationId/messages', verifyToken, handleErrorAsync(getChatHistory()));
router.post('/upload-media', verifyToken, uploadPhoto.single('media'), handleErrorAsync(uploadMediaMessage()));

export default router;