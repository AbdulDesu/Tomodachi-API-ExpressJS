import prisma from "../config/database.js";

const generateRandomOffset = (baseCoord, maxOffsetKm) => {
    const offsetDegrees = maxOffsetKm / 111;
    return baseCoord + (Math.random() * 2 - 1) * offsetDegrees;
};

const namePool = {
    MALE: ['Radit', 'Reno', 'Dimas', 'Haikal', 'Arkan', 'Gilang', 'Jefri', 'Bintang', 'Dika', 'Naufal'],

    FEMALE: ['Dinda', 'Tasya', 'Amel', 'Nadhira', 'Kanya', 'Tiara', 'Sisca', 'Aurel', 'Rania', 'Bella']
};

const bioPool = {
    MALE: [
        'Anak rumahan tapi gampang diajak nongkrong. Btw, bubur diaduk > ga diaduk.',
        'Kerja 9 to 5, sisa waktunya buat netflix dan nge-gym (kadang). Swipe right if you like bad jokes.',
        'Kalo kamu cari yang bisa benerin genteng bocor, aku mundur. Tapi kalo cari temen kulineran malem, gas.',
        'Cuma cowok biasa yang gampang ketawa sama meme receh. Ayo mabar ML/Valo!',
        'Bukan anak senja, cuma butuh kopi ekstra buat melek kerja. Bales chat cepet kalo ga lagi riding.'
    ],
    FEMALE: [
        'Lagi nyari partner buat nonton konser dan cobain cafe baru. Match me if you are fun!',
        'Pecinta kucing, matcha latte, dan playlist spotify galau. Aslinya bawel kalo udah klop.',
        'Suka jalan-jalan random tapi gampang capek. Temenin nugas atau wfc yuk!',
        'Aslinya pendiem, tapi suka ngirim tiktok absurd jam 2 pagi. Lagi suka thrifting & museum date.',
        'Bukan akun fake apalagi bot, sumpah. Cuma lagi bosen dan pengen cari temen ngobrol.'
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