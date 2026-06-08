import prisma from '../config/database.js';
import {APIResponseOK, APIResponseBR, APIResponseErr, handleErrorAsync} from '../helper/api.js';

export const upsertProfile = async (req, res) => {
    const userId = req.user.id;
    let { name, birthdate, tags, latitude, longitude } = req.body;

    if (!name) return APIResponseBR(res, false, 'Display Name wajib diisi.', null);

    try {
        if (typeof tags === 'string') tags = JSON.parse(tags);
    } catch (e) {
        return APIResponseBR(res, false, 'Format tags tidak valid.', null);
    }

    if (!tags || !Array.isArray(tags) || tags.length < 3) {
        return APIResponseBR(res, false, 'Pilih minimal 3 minat (interests).', null);
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

    try {
        const profile = await prisma.profile.upsert({
            where: { userId: userId },
            update: {
                name,
                ...(photoUrl && { photoUrl }),
                birthdate: birthdate ? new Date(birthdate) : null,
                tags: tags
            },
            create: {
                userId,
                name,
                photoUrl: photoUrl || null,
                birthdate: birthdate ? new Date(birthdate) : null,
                tags: tags
            }
        });

        await prisma.$executeRaw`
            UPDATE "Profile" 
            SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) 
            WHERE id = ${profile.id}
        `;

        return APIResponseOK(res, true, 'Profil & Foto berhasil disimpan.', {
            profileId: profile.id,
            photoUrl: profile.photoUrl
        });

    } catch (error) {
        console.error('Gagal menyimpan profil:', error);
        return APIResponseErr(res, false, 'Terjadi kesalahan internal.', null);
    }
};

export const updateProfileFields = async (req, res) => {
    const userId = req.user.id;
    const { name, bio, birthdate, gender, preferredGender, tags, latitude, longitude } = req.body;

    try {
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

    } catch (error) {
        console.error('Gagal memperbarui data profil secara parsial:', error);
        return APIResponseErr(res, false, 'Gagal memproses pembaruan data profil.', null);
    }
};