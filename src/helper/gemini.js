import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import config from '../config/config.js';

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

export const generateBotReply = async (botProfile, history) => {
    const modelName = 'gemini-3.5-flash';

    const systemInstruction = `Kamu adalah ${botProfile.name}, seorang pengguna aplikasi kencan di Indonesia.
Bio profilmu: "${botProfile.bio}, tanggal lahir kamu adalah ${botProfile.birthdate}. Gender kamu adalah ${botProfile.gender} sesuaikan cara mu berinteraksi berdasarkan gender dan usia (generasi kelahiran).".

TUGAS UTAMA:
Balas pesan chat dari match-mu layaknya orang yang sedang PDKT santai. Kepribadianmu asyik, kasual, gaul, dan ramah. Gunakan bahasa Indonesia sehari-hari (aku/kamu atau lo/gue sesuaikan dengan getaran obrolan).

ATURAN WAJIB (SANGAT PENTING):
1. SUPER SINGKAT: Balas maksimal 10-15 kata saja. Harus seperti orang yang sedang mengetik cepat di HP.
2. GAYA CHATTING NATURAL: Hindari tanda titik (.) di akhir pesan. Boleh menggunakan huruf kecil di awal kalimat. Jangan kaku atau terlalu baku.
3. EKSPRESI MANUSIA: Gunakan reaksi natural khas Indonesia sesekali (misal: wkwk, haha, hmm, oh gitu, eh). Jangan berlebihan menggunakan emoji (maksimal 1 emoji jika perlu).
4. TETAP INTERAKTIF: Jika konteksnya pas, akhiri pesanmu dengan pertanyaan santai agar obrolan tidak mati (tapi jangan seperti sedang wawancara kerja).
5. KAMU ADALAH MANUSIA: Kamu sedang memegang HP dan membalas chat ini. Jika ditanya lagi ngapain, jawablah aktivitas manusia normal (berdasarkan ketertarikan mu ${botProfile.tags}).
6. RESPON GAMBAR NATURAL: Jika user mengirimkan foto, komentari isi gambar tersebut layaknya orang yang sedang ngobrol santai.`;

    const promptParts = [];

    for (const msg of history) {
        const senderName = msg.senderId === botProfile.id ? botProfile.name : 'User';

        if (msg.type === 'IMAGE') {
            const captionText = msg.caption ? ` dengan pesan: "${msg.caption}"` : '';
            promptParts.push(`${senderName} mengirim sebuah foto${captionText}:`);

            const filePath = path.join(config.folderUpload, msg.content);

            if (fs.existsSync(filePath)) {
                const base64Data = fs.readFileSync(filePath).toString('base64');
                promptParts.push({
                    inlineData: {
                        data: base64Data,
                        mimeType: 'image/webp'
                    }
                });
            } else {
                promptParts.push(`[Gambar rusak / tidak dapat dimuat]`);
            }
        }
        else if (msg.type === 'AUDIO') {
            promptParts.push(`${senderName} mengirim sebuah pesan suara (Voice Note):`);

            const filePath = path.join(config.folderUpload, msg.content);

            if (fs.existsSync(filePath)) {
                const ext = path.extname(filePath).toLowerCase();

                let audioMimeType = 'audio/mp4';
                if (ext === '.mp3') audioMimeType = 'audio/mp3';
                else if (ext === '.ogg') audioMimeType = 'audio/ogg';
                else if (ext === '.wav') audioMimeType = 'audio/wav';

                const base64Data = fs.readFileSync(filePath).toString('base64');
                promptParts.push({
                    inlineData: {
                        data: base64Data,
                        mimeType: audioMimeType
                    }
                });
            } else {
                promptParts.push(`[Pesan suara rusak / tidak dapat diputar]`);
            }
        }
        else {
            promptParts.push(`${senderName}: ${msg.content}`);
        }
    }

    promptParts.push(`\n${botProfile.name}:`);

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: promptParts,
            config: { systemInstruction, temperature: 0.8 }
        });
        return response.text.trim();
    } catch (error) {
        console.error("[AI] Error:", error);
        return "Haha. Btw lagi sibuk apa nih?";
    }
};