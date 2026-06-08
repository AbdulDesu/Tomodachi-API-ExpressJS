import {createClient} from 'redis';

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 20) {
                console.error('Redis: Maksimal percobaan koneksi tercapai. Menghentikan proses reconnect.');
                return new Error('Retry time exhausted');
            }
            return Math.min(retries * 100, 3000);
        }
    }
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err.message));
redisClient.on('connect', () => console.log('Redis: Sambungan berhasil dibuat.'));
redisClient.on('ready', () => console.log('Redis: Siap menerima perintah.'));
redisClient.on('reconnecting', () => console.warn('Redis: Mencoba menyambungkan kembali...'));

export const connectRedis = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
    } catch (error) {
        console.error('Gagal menginisialisasi Redis:', error.message);
    }
};

export default redisClient;