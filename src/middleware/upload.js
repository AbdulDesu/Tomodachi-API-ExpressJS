import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import config from '../config/config.js';

const uploadDir = config.folderUpload;
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 1. Gunakan Memory Storage agar file ditahan di RAM (buffer) untuk diproses Sharp
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Bukan gambar! Silakan upload file gambar JPG/PNG/WebP.'), false);
    }
};

export const uploadPhoto = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: fileFilter
});

export const compressImage = async (req, res, next) => {
    if (!req.file && (!req.files || req.files.length === 0)) {
        return next();
    }

    try {
        const processFile = async (file) => {
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
            const filename = `${uniqueSuffix}.webp`;
            const filepath = path.join(uploadDir, filename);

            // Proses Kompresi Tingkat Tinggi
            await sharp(file.buffer)
                .resize({
                    width: 1080,
                    withoutEnlargement: true
                })
                .webp({ quality: 80 })
                .toFile(filepath);

            file.filename = filename;
            file.path = filepath;
        };

        if (req.file) {
            await processFile(req.file);
        }

        if (req.files && Array.isArray(req.files)) {
            await Promise.all(req.files.map(file => processFile(file)));
        }

        next();
    } catch (error) {
        console.error("[Sharp] Gagal mengkompresi gambar:", error);
        return res.status(500).json({ success: false, message: "Terjadi kesalahan internal saat memproses gambar." });
    }
};