import { Router } from 'express';
import {getProfileById, updateProfileFields, upsertProfile, uploadHighlightPhotos} from '../controllers/profile.controller.js';
import { verifyToken } from '../middleware/auth.js';
import { uploadPhoto, compressImage } from '../middleware/upload.js';

const router = Router();

router.get("/", verifyToken, getProfileById)

router.post('/upsert', verifyToken, uploadPhoto.single('photo'), compressImage, upsertProfile);

router.patch('/edit', verifyToken, uploadPhoto.single('photo'), compressImage, updateProfileFields);

router.post('/highlights', verifyToken, uploadPhoto.array('highlights', 6), compressImage, uploadHighlightPhotos);

export default router;