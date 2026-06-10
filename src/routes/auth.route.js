import { Router } from 'express';
import {
    identifyPhoneNumber,
    loginWithPassword,
    requestOtp, resendOtp,
    setAccountPassword,
    verifyOtp
} from '../controllers/auth.controller.js';
import {verifyToken} from "../middleware/auth.js";

const router = Router();

router.post('/request-otp', requestOtp);
router.post('/resend-otp', resendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/activate-password', verifyToken, setAccountPassword);
router.post('/login-password', loginWithPassword);
router.post('/identify-phone', identifyPhoneNumber)

export default router;