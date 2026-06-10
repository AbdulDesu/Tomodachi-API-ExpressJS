import { Router } from 'express';
import {updateProfileFields, upsertProfile} from '../controllers/profile.controller.js';
import { verifyToken } from '../middleware/auth.js';
import { uploadPhoto } from '../middleware/upload.js';
import { handleErrorAsync } from '../helper/api.js';

const router = Router();

router.post('/upsert',
    uploadPhoto.single('photo'),
    upsertProfile
);

router.patch('/edit', verifyToken, uploadPhoto.single('photo'), handleErrorAsync(updateProfileFields));

export default router;