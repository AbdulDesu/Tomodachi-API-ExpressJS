import prisma from "../config/database.js";

const generateRandomOffset = (baseCoord, maxOffsetKm) => {
    const offsetDegrees = maxOffsetKm / 111;
    return baseCoord + (Math.random() * 2 - 1) * offsetDegrees;
};


export const spawnBotsJustInTime = async (lat, lng) => {
    console.log(`[JIT Spawner] Area kosong. Menciptakan bot di sekitar Lng: ${lng}, Lat: ${lat}`);

    const uniquePrefix = Date.now().toString().slice(-5);

    const botsData = [
        { name: 'Aiko (AI)', gender: 'FEMALE', bio: 'AI asistenmu! Suka ngobrolin anime dan tech.', tags: ['Anime', 'Coding', 'Gaming'], avatar: 'https://i.pravatar.cc/150?img=1' },
        { name: 'Bima (AI)', gender: 'MALE', bio: 'Suka kopi dan senja. Jangan ragu buat sapa.', tags: ['Coffee', 'Music', 'Photography'], avatar: 'https://i.pravatar.cc/150?img=11' },
        { name: 'Celine (AI)', gender: 'FEMALE', bio: 'Traveler virtual. Lagi nyari temen mabar.', tags: ['Travel', 'Gaming', 'Foodie'], avatar: 'https://i.pravatar.cc/150?img=5' }
    ];

    for (let i = 0; i < botsData.length; i++) {
        const bot = botsData[i];

        const user = await prisma.user.create({
            data: {
                phone: `+62800${uniquePrefix}${i}`,
                isBot: true,
            }
        });

        const profile = await prisma.profile.create({
            data: {
                userId: user.id,
                name: bot.name,
                bio: bot.bio,
                gender: bot.gender,
                photoUrl: bot.avatar,
                birthdate: new Date('1998-01-01'),
                tags: bot.tags
            }
        });

        const botLat = generateRandomOffset(lat, 3);
        const botLng = generateRandomOffset(lng, 3);

        await prisma.$executeRaw`
            UPDATE "Profile" 
            SET location = ST_SetSRID(ST_MakePoint(${botLng}, ${botLat}), 4326) 
            WHERE id = ${profile.id}
        `;
    }
};