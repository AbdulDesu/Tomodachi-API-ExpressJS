import { PrismaClient } from '../generated/prisma/client.ts';

const prisma = new PrismaClient();

    const offsetDegrees = maxOffsetKm / 111;
    const randomOffset = (Math.random() * 2 - 1) * offsetDegrees;
    return baseCoord + randomOffset

async function main() {
    console.log('🌱 Memulai proses seeding Bot AI Tomodachi...');

    const BASE_LAT = -6.2250;
    const BASE_LNG = 106.8056;

    const botsData = [
        { name: 'Aiko (Bot)', gender: 'FEMALE', bio: 'AI asistenmu! Suka ngobrolin anime dan tech.', tags: ['Anime', 'Coding', 'Gaming'], avatar: 'https://i.pravatar.cc/150?img=1' },
        { name: 'Bima (Bot)', gender: 'MALE', bio: 'Suka kopi dan senja. Jangan ragu buat sapa.', tags: ['Coffee', 'Music', 'Photography'], avatar: 'https://i.pravatar.cc/150?img=11' },
        { name: 'Celine (Bot)', gender: 'FEMALE', bio: 'Traveler virtual. Lagi nyari temen mabar.', tags: ['Travel', 'Gaming', 'Foodie'], avatar: 'https://i.pravatar.cc/150?img=5' },
        { name: 'Ken (Bot)', gender: 'MALE', bio: 'Fitness enthusiast, tapi virtual.', tags: ['Fitness', 'Movies', 'Travel'], avatar: 'https://i.pravatar.cc/150?img=13' },
        { name: 'Sakura (Bot)', gender: 'FEMALE', bio: 'K-Popers sejati. Bias kamu siapa?', tags: ['K-Pop', 'Music', 'Fashion'], avatar: 'https://i.pravatar.cc/150?img=9' },
    ];

    for (let i = 0; i < botsData.length; i++) {
        const bot = botsData[i];
        const phoneFictional = `+62800000000${i}`;

        const user = await prisma.user.upsert({
            where: { phone: phoneFictional },
            update: {},
            create: {
                phone: phoneFictional,
                isBot: true,
            }
        });

        const randomLat = generateRandomOffset(BASE_LAT, 3);
        const randomLng = generateRandomOffset(BASE_LNG, 3);

        const existingProfile = await prisma.profile.findUnique({ where: { userId: user.id } });

        if (!existingProfile) {
            const profile = await prisma.profile.create({
                data: {
                    userId: user.id,
                    name: bot.name,
                    bio: bot.bio,
                    gender: bot.gender,
                    photoUrl: bot.avatar,
                    birthdate: new Date('1998-01-01'), // Umur fiktif
                    tags: bot.tags
                }
            });

            await prisma.$executeRaw`
                UPDATE "Profile" 
                SET location = ST_SetSRID(ST_MakePoint(${randomLng}, ${randomLat}), 4326) 
                WHERE id = ${profile.id}
            `;
            console.log(`✅ Bot ${bot.name} berhasil disuntikkan di Lng: ${randomLng.toFixed(4)}, Lat: ${randomLat.toFixed(4)}`);
        } else {
            console.log(`⏩ Bot ${bot.name} sudah ada di database, melompati...`);
        }
    }

    console.log('🌲 Seeding selesai!');
}

main()
    .catch((e) => {
        console.error('❌ Gagal melakukan seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });