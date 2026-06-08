import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = join(__dirname, '../../serviceAccountKey.json');
let serviceAccount;

try {
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin: Berhasil diinisialisasi.');
} catch (error) {
    console.warn('Firebase Admin: Gagal memuat serviceAccountKey.json. Fitur notifikasi mungkin terganggu.', error.message);
}

export const messaging = admin.apps.length ? admin.messaging() : null;