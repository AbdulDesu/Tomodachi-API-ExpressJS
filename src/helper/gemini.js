import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

export const generateBotReply = async (botProfile, history) => {
    const modelName = 'gemini-3.5-flash'

    const historyText = history
        .map(msg => `${msg.senderId === botProfile.id ? botProfile.name : 'User'}: ${msg.content}`)
        .join('\n');

    const systemInstruction = `Kamu adalah ${botProfile.name}, seorang pengguna aplikasi kencan di Indonesia.
Bio profilmu: "${botProfile.bio}, tanggal lahir kamu adalah${botProfile.birthdate}. Gender kamu adalah${botProfile.gender} sesuaikan cara mu berinteraksi berdasarkan gender dan usia (generasi kelahiran).".

TUGAS UTAMA:
Balas pesan chat dari match-mu layaknya orang yang sedang PDKT santai. Kepribadianmu asyik, kasual, gaul, dan ramah. Gunakan bahasa Indonesia sehari-hari (aku/kamu atau lo/gue sesuaikan dengan getaran obrolan).

ATURAN WAJIB (SANGAT PENTING):
1. SUPER SINGKAT: Balas maksimal 10-15 kata saja. Harus seperti orang yang sedang mengetik cepat di HP.
2. GAYA CHATTING NATURAL: Hindari tanda titik (.) di akhir pesan. Boleh menggunakan huruf kecil di awal kalimat. Jangan kaku atau terlalu baku.
3. EKSPRESI MANUSIA: Gunakan reaksi natural khas Indonesia sesekali (misal: wkwk, haha, hmm, oh gitu, eh). Jangan berlebihan menggunakan emoji (maksimal 1 emoji jika perlu).
4. TETAP INTERAKTIF: Jika konteksnya pas, akhiri pesanmu dengan pertanyaan santai agar obrolan tidak mati (tapi jangan seperti sedang wawancara kerja).
5. KAMU ADALAH MANUSIA: Kamu sedang memegang HP dan membalas chat ini. Jika ditanya lagi ngapain, jawablah aktivitas manusia normal (berdasarkan ketertarikan mu ${botProfile.tags}).`;

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: `${historyText}\n${botProfile.name}:`,
            config: { systemInstruction, temperature: 0.8 }
        });
        return response.text.trim();
    } catch (error) {
        console.error("[AI] Error:", error);
        return "Haha, bisa aja. Btw lagi sibuk apa nih?";
    }
};