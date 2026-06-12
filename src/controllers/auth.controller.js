import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import redisClient from '../config/redis.js';
import prisma from '../config/database.js';
import { messaging } from '../config/firebase.js';
import {
    APIResponseOK,
    APIResponseBR,
    APIResponseErr,
    handleErrorAsync,
    APIResponseUnAuth,
    APIResponseNF
} from '../helper/api.js';

const JWT_SECRET = process.env.JWT_SECRET || 'tomodachi-super-secret-key-2026';
const OTP_TTL_SECONDS = 180;
const SALT_ROUNDS = 10;

export const requestOtp = handleErrorAsync(async (req, res) => {
    const { phone, fcmToken } = req.body;

    if (!phone || !fcmToken) {
        return APIResponseBR(res, false, 'Nomor telepon dan FCM Token wajib diisi.');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const redisKey = `otp:${phone}`;
    await redisClient.setEx(redisKey, OTP_TTL_SECONDS, otp);

    if (messaging) {
        try {
            await messaging.send({
                token: fcmToken,
                notification: {
                    title: 'Kode Login Tomodachi',
                    body: `${otp} adalah kode rahasia Anda. Jangan berikan kepada siapapun!`
                },
                data: {
                    type: 'OTP_SIMULATION',
                    otp: otp
                }
            });
        } catch (error) {
            console.error('Gagal mengirim FCM OTP:', error);
        }
    }

    console.log(`[DEV ONLY] OTP untuk ${phone} adalah: ${otp}`);

    return APIResponseOK(res, true, 'OTP berhasil dikirim via notifikasi.');
});

export const resendOtp = handleErrorAsync(async (req, res) => {
    const { phone, fcmToken } = req.body;

    if (!phone || !fcmToken) {
        return APIResponseBR(res, false, 'Nomor telepon dan FCM Token wajib diisi.');
    }

    const redisKey = `otp:${phone}`;

    const currentTTL = await redisClient.ttl(redisKey);

    if (currentTTL > 0 && currentTTL > (OTP_TTL_SECONDS - 60)) {
        const waitTime = currentTTL - (OTP_TTL_SECONDS - 60);
        return APIResponseBR(res, false, `Harap tunggu ${waitTime} detik sebelum meminta OTP baru.`);
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

    await redisClient.setEx(redisKey, OTP_TTL_SECONDS, newOtp);

    if (messaging) {
        try {
            await messaging.send({
                token: fcmToken,
                notification: {
                    title: 'Kode Login Baru Tomodachi',
                    body: `${newOtp} adalah kode rahasia TERBARU Anda. Jangan berikan kepada siapapun!`
                },
                data: {
                    type: 'OTP_SIMULATION',
                    otp: newOtp
                }
            });
        } catch (error) {
            console.error('Gagal mengirim ulang FCM OTP:', error);
        }
    }

    console.log(`[DEV ONLY - RESEND] OTP TERBARU untuk ${phone} adalah: ${newOtp}`);

    return APIResponseOK(res, true, 'OTP terbaru berhasil dikirim via notifikasi.');
});

export const verifyOtp = handleErrorAsync(async (req, res) => {
    const { phone, otp, fcmToken } = req.body;

    if (!phone || !otp) {
        return APIResponseBR(res, false, 'Nomor telepon dan OTP wajib diisi.');
    }

    const redisKey = `otp:${phone}`;

    const cachedOtp = await redisClient.get(redisKey);

    if (!cachedOtp) {
        return APIResponseBR(res, false, 'OTP sudah kadaluarsa atau tidak valid.');
    }

    if (cachedOtp !== otp) {
        return APIResponseBR(res, false, 'Kode OTP salah.');
    }

    await redisClient.del(redisKey);

    const user = await prisma.user.upsert({
        where: { phone: phone },
        update: {
            fcmToken: fcmToken || null
        },
        create: {
            phone: phone,
            fcmToken: fcmToken || null,
            isBot: false
        }
    });

    const token = jwt.sign(
        { userId: user.id },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });

    return APIResponseOK(res, true, 'Login berhasil.', {
        token,
        user,
        isProfileComplete: !!profile
    });
});

export const setAccountPassword = handleErrorAsync(async (req, res) => {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password || password.length < 6) {
        return APIResponseBR(res, false, 'Password minimal harus terdiri dari 6 karakter.');
    }

    try {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        return APIResponseOK(res, true, 'Keamanan akun berhasil ditingkatkan. Password telah aktif.');
    } catch (error) {
        console.error('Gagal menyetel password:', error);
        return APIResponseErr(res, false, 'Terjadi kesalahan internal saat memproses password.');
    }
});

export const loginWithPassword = handleErrorAsync(async (req, res) => {
    const { phone, password, fcmToken } = req.body;

    if (!phone || !password) {
        return APIResponseBR(res, false, 'Nomor telepon dan password wajib diisi.');
    }

    try {
        const user = await prisma.user.findUnique({
            where: { phone: phone }
        });

        if (!user || !user.password) {
            return APIResponseUnAuth(res, false, 'Kredensial salah atau akun Anda belum mengaktifkan password.');
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (!isPasswordMatch) {
            return APIResponseUnAuth(res, false, 'Nomor telepon atau password salah.');
        }

        if (fcmToken && fcmToken !== user.fcmToken) {
            await prisma.user.update({
                where: { id: user.id },
                data: { fcmToken: fcmToken }
            });
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
        const profile = await prisma.profile.findUnique({ where: { userId: user.id } });

        return APIResponseOK(res, true, 'Login berhasil via password.', {
            token,
            user: { id: user.id, phone: user.phone, isBot: user.isBot },
            isProfileComplete: !!profile
        });

    } catch (error) {
        console.error('Gagal login via password:', error);
        return APIResponseErr(res, false, 'Terjadi kesalahan sistem saat memproses login.');
    }
});

export const identifyPhoneNumber = handleErrorAsync(async (req, res) => {
    const {phone} = req.body;

    if (!phone || !phone.length) {
        return APIResponseBR(res, false, "Nomor Telepon dan password wajib diisi.");
    }

    const userData = await prisma.user.findUnique({ where: { phone: phone } });

    if (!userData) {
        return APIResponseNF(res, true, "Nomor telepon belum terdaftar. Silakan lanjutkan dengan OTP untuk membuat akun baru.")
    }

    if(userData.password != null){
        return APIResponseOK(res, false, 'Nomor Telepon ditemukan, dengan 2nd Auth')
    }

    return APIResponseOK(res,true, "Login Berhasil." );
})