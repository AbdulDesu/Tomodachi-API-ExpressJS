import prisma from '../config/database.js';
import {APIResponseOK, APIResponseBR, APIResponseErr, APIResponseNF} from '../helper/api.js';

export const getProfileById = async (req, res) =>{
    const userId = req.user.id;

    const userData = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            isBot: true,
            profile: true,
            photos: {
                orderBy: { order: 'asc' },
                select: {
                    id: true,
                    url: true,
                    order: true
                }
            }
        }
    });

    if (!userData || !userData.profile) {
        return APIResponseNF(res, false, 'Profil tidak ditemukan.');
    }

    const formattedProfile = {
        userId: userData.id,
        isBot: userData.isBot,
        ...userData.profile,
        highlightPhotos: userData.photos
    };

    return APIResponseOK(res, true, "Berhasil mendapatkan profil lengkap", formattedProfile);
};

export const upsertProfile = async (req, res) => {
    const userId = req.user.id;

    let { name, birthdate, tags, latitude, longitude, pGender, gender } = req.body;

    if (!name) return APIResponseBR(res, false, 'Display Name wajib diisi.', null);

    if (!gender || !['MALE', 'FEMALE', 'BOTH'].includes(gender)) {
        return APIResponseBR(res, false, 'Identitas gender wajib diisi dan valid.', null);
    }
    if (!pGender || !['MALE', 'FEMALE', 'BOTH'].includes(pGender)) {
        return APIResponseBR(res, false, 'Preferensi gender wajib diisi dan valid.', null);
    }

    try {
        if (typeof tags === 'string') tags = JSON.parse(tags);
    } catch (e) {
        return APIResponseBR(res, false, 'Format tags tidak valid.', null);
    }

    if (!tags || !Array.isArray(tags) || tags.length < 3) {
        return APIResponseBR(res, false, 'Pilih minimal 3 minat.', null);
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) {
        return APIResponseBR(res, false, 'Koordinat lokasi tidak valid.', null);
    }

    let photoUrl = null;
    if (req.file) {
        photoUrl = req.file.filename;
    }

    let validBirthdate = null;
    if (birthdate) {
        const parsedDate = new Date(birthdate);
        if (!isNaN(parsedDate.getTime())) {
            validBirthdate = parsedDate;
        }
    }

    let profile = await prisma.profile.findFirst({
        where: { userId: userId }
    });

    const dataPayload = {
        name,
        ...(photoUrl && { photoUrl }),
        birthdate: validBirthdate,
        tags: tags,
        gender: gender,
        preferredGender: pGender
    };

    if (profile) {
        profile = await prisma.profile.update({
            where: { id: profile.id },
            data: dataPayload
        });
    } else {
        profile = await prisma.profile.create({
            data: {
                userId: userId,
                ...dataPayload
            }
        });
    }

    await prisma.$executeRaw`
            UPDATE "Profile"
            SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
            WHERE id = ${profile.id}
        `;

    return APIResponseOK(res, true, 'Profil & Foto berhasil disimpan.', {
        profileId: profile.id,
        photoUrl: profile.photoUrl
    });
};

export const updateProfileFields = async (req, res) => {
    const userId = req.user.id;
    const { name, bio, birthdate, gender, preferredGender, tags, latitude, longitude } = req.body;

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (gender !== undefined) updateData.gender = gender;
    if (preferredGender !== undefined) updateData.preferredGender = preferredGender;
    if (birthdate !== undefined) updateData.birthdate = birthdate ? new Date(birthdate) : null;

    if (tags !== undefined) {
        updateData.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
        if (updateData.tags.length < 3) {
            return APIResponseBR(res, false, 'Minat (tags) minimal harus berjumlah 3 opsi.', null);
        }
    }

    if (req.file) {
        updateData.photoUrl = req.file.filename;
    }

    const updatedProfile = await prisma.profile.update({
        where: { userId: userId },
        data: updateData
    });

    if (latitude !== undefined && longitude !== undefined) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        if (!isNaN(lat) && !isNaN(lng)) {
            await prisma.$executeRaw`
                    UPDATE "Profile"
                    SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
                    WHERE "userId" = ${userId}
                `;
        }
    }

    return APIResponseOK(res, true, 'Perubahan profil berhasil disimpan.', updatedProfile);
};

export const uploadHighlightPhotos = async (req, res) => {
    const userId = req.user.id;
    const files = req.files;

    if (!files || files.length === 0) {
        return APIResponseBR(res, false, 'Tidak ada foto yang diunggah.', null);
    }

    const currentPhotosCount = await prisma.userPhoto.count({
        where: { userId: userId }
    });

    const maxPhotosAllowed = 6;
    if (currentPhotosCount + files.length > maxPhotosAllowed) {
        return APIResponseBR(res, false, `Kuota penuh. Kamu hanya bisa menambah ${maxPhotosAllowed - currentPhotosCount} foto lagi.`, null);
    }

    const lastPhoto = await prisma.userPhoto.aggregate({
        where: { userId: userId },
        _max: { order: true }
    });

    let nextOrder = lastPhoto._max.order !== null ? lastPhoto._max.order + 1 : 0;

    const photosData = files.map((file) => {
        const data = {
            userId: userId,
            url: file.filename,
            order: nextOrder
        };
        nextOrder++;
        return data;
    });

    await prisma.userPhoto.createMany({
        data: photosData
    });

    const updatedHighlights = await prisma.userPhoto.findMany({
        where: { userId: userId },
        orderBy: { order: 'asc' },
        select: { id: true, url: true, order: true }
    });

    return APIResponseOK(res, true, 'Highlight foto berhasil ditambahkan.', updatedHighlights);
};