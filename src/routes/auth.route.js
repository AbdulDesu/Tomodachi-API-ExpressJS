import { Router } from 'express';
import {loginWithPassword, requestOtp, setAccountPassword, verifyOtp} from '../controllers/auth.controller.js';
import {verifyToken} from "../middleware/auth.js";

const router = Router();

router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/activate-password', verifyToken, setAccountPassword);
router.post('/login-password', loginWithPassword);

export default router;