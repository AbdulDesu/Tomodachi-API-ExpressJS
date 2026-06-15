import prisma from "../config/database.js";

const generateRandomOffset = (baseCoord, maxOffsetKm) => {
    const offsetDegrees = maxOffsetKm / 111;
    return baseCoord + (Math.random() * 2 - 1) * offsetDegrees;
};

const namePool = {
    MALE: ['Bima', 'Ken', 'Raka', 'Kevin', 'Leon', 'Arya', 'Dion', 'Reza'],
    FEMALE: ['Aiko', 'Celine', 'Sakura', 'Hana', 'Maya', 'Nadia', 'Zara', 'Luna']
};

const bioPool = {
    MALE: [
        'Suka kopi dan senja. Jangan ragu buat sapa.',
        'Fitness enthusiast, tapi virtual.',
        'Gamer sejati. Ayo mabar rank!',
        'Suka fotografi dan jalan-jalan keliling kota.'
    ],
    FEMALE: [
        'AI asistenmu! Suka ngobrolin anime dan tech.',
        'Traveler virtual. Lagi nyari temen mabar.',
        'Suka rebahan sambil dengerin K-Pop.',
        'Pecinta kucing, matcha, dan buku fiksi.'
    ]
};

const avatarPool = {
    MALE: [3, 4, 8, 11, 12, 13, 14, 15, 33, 53, 59, 60, 68],
    FEMALE: [1, 5, 9, 10, 16, 19, 20, 24, 26, 32, 38, 44, 47]
};

const tagPool = [
    'Anime', 'Coding', 'Gaming', 'Coffee', 'Music', 'Photography',
    'Travel', 'Foodie', 'K-Pop', 'Fitness', 'Movies', 'Fashion', 'Art', 'Books'
];

const getRandomItem = (array) => array[Math.floor(Math.random() * array.length)];

const getRandomTags = (count) => {
    const shuffled = [...tagPool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

const getRandomAdultBirthdate = () => {
    const currentYear = new Date().getFullYear();
    const minAge = 18;
    const maxAge = 35;

    const randomAge = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
    const birthYear = currentYear - randomAge;
    const birthMonth = Math.floor(Math.random() * 12);
    const birthDay = Math.floor(Math.random() * 28) + 1;

    return new Date(Date.UTC(birthYear, birthMonth, birthDay));
};

export const spawnBotsJustInTime = async (lat, lng) => {
    console.log(`[JIT Spawner] Area kosong. Merakit bot di sekitar Lng: ${lng}, Lat: ${lat}`);

    const uniquePrefix = Date.now().toString().slice(-5);
    const numberOfBotsToSpawn = 4;

    for (let i = 0; i < numberOfBotsToSpawn; i++) {
        const gender = Math.random() > 0.5 ? 'FEMALE' : 'MALE';

        const botName = `${getRandomItem(namePool[gender])} (AI)`;
        const botBio = getRandomItem(bioPool[gender]);
        const botTags = getRandomTags(3);
        const botBirthdate = getRandomAdultBirthdate();

        const randomImageId = getRandomItem(avatarPool[gender]);
        const botAvatar = `https://i.pravatar.cc/1000?img=${randomImageId}`;

        const user = await prisma.user.create({
            data: {
                phone: `+62800${uniquePrefix}${i}`,
                isBot: true,
            }
        });

        const profile = await prisma.profile.create({
            data: {
                userId: user.id,
                name: botName,
                bio: botBio,
                gender: gender,
                photoUrl: botAvatar,
                birthdate: botBirthdate,
                tags: botTags,
                preferredGender: 'BOTH'
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
    console.log(`[JIT Spawner] ${numberOfBotsToSpawn} bot berhasil dirakit dengan umur dan avatar yang relevan.`);
};