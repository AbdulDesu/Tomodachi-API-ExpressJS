import { Router } from 'express';
import {loginWithPassword, requestOtp, setAccountPassword, verifyOtp} from '../controllers/auth.controller.js';
import { handleErrorAsync } from '../helper/api.js';
import {verifyToken} from "../middleware/auth.js";

const router = Router();

router.post('/request-otp', handleErrorAsync(requestOtp));
router.post('/verify-otp', handleErrorAsync(verifyOtp));
router.post('/activate-password', verifyToken, handleErrorAsync(setAccountPassword));
router.post('/login-password', handleErrorAsync(loginWithPassword));

export default router;