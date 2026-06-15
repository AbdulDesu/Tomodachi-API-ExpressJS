import prisma from '../config/database.js';
import {APIResponseBR, APIResponseErr, APIResponseOK, handleErrorAsync} from "../helper/api.js";
import {spawnBotsJustInTime} from "../helper/spawner.js";

export const getNearbyProfiles = handleErrorAsync(async (req, res) => {
    const userId = req.user.id;
    const radiusKm = parseInt(req.query.radius) || 10;
    const limit = parseInt(req.query.limit) || 20;

    const currentUserData = await prisma.$queryRaw`
        SELECT ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat, "preferredGender"
        FROM "Profile"
        WHERE "userId" = ${userId}
            LIMIT 1;
    `;

    if (!currentUserData || currentUserData.length === 0) {
        return APIResponseBR(res, false, 'Profil Anda belum lengkap. Silakan lengkapi lokasi Anda terlebih dahulu.', null);
    }

    const { lng, lat, preferredGender } = currentUserData[0];

    if (lng === null || lat === null) {
        return APIResponseBR(res, false, 'Data lokasi Anda tidak valid.', null);
    }

    const radiusInMeters = radiusKm * 1000;

    const fetchProfiles = async () => {
        return await prisma.$queryRaw`
            SELECT 
                p.id AS "profileId", 
                p."userId", 
                p.name, 
                p."photoUrl", 
                p.bio, 
                p.tags, 
                p.birthdate,
                u."isBot",
                ROUND((ST_DistanceSphere(p.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)) / 1000)::numeric, 1) AS "distanceKm"
            FROM "Profile" p
            INNER JOIN "User" u ON p."userId" = u.id
            WHERE p."userId" != ${userId}
     
            AND u.id NOT IN (
                SELECT "swipeeId" FROM "Swipe" WHERE "swiperId" = ${userId}
            )

              AND (
                p.gender = CAST(${preferredGender} AS "Gender")
               OR CAST(${preferredGender} AS TEXT) = 'BOTH'
               OR CAST(${preferredGender} AS TEXT) IS NULL
                )
            
            AND ST_DWithin(
                p.location::geography, 
                ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, 
                ${radiusInMeters}
            )
            ORDER BY "distanceKm" ASC
            LIMIT ${limit};
        `;
    };

    let nearbyProfiles = await fetchProfiles();

    if (nearbyProfiles.length === 0) {
        await spawnBotsJustInTime(lat, lng);
        nearbyProfiles = await fetchProfiles();
    }

    return APIResponseOK(res, true, 'Berhasil memuat profil di sekitar.', nearbyProfiles);
});

export const processSwipe = handleErrorAsync(async (req, res) => {
    const swiperId = req.user.id;
    const { targetUserId, action } = req.body;

    if (!targetUserId || !['LIKE', 'DISLIKE'].includes(action)) {
        return APIResponseBR(res, false, 'Data target atau aksi tidak valid.', null);
    }

    if (swiperId === targetUserId) {
        return APIResponseBR(res, false, 'Tidak dapat melakukan swipe pada diri sendiri.', null);
    }

    try {
        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, isBot: true }
        });

        if (!targetUser) {
            return APIResponseBR(res, false, 'Pengguna target tidak ditemukan.', null);
        }

        await prisma.swipe.upsert({
            where: {
                swiperId_swipeeId: {
                    swiperId: swiperId,
                    swipeeId: targetUserId
                }
            },
            update: { type: action },
            create: {
                swiperId: swiperId,
                swipeeId: targetUserId,
                type: action
            }
        });

        let isMatch = false;
        let conversationId = null;

        if (action === 'LIKE') {

            if (targetUser.isBot) {
                isMatch = true;

                await prisma.swipe.upsert({
                    where: { swiperId_swipeeId: { swiperId: targetUserId, swipeeId: swiperId } },
                    update: { type: 'LIKE' },
                    create: { swiperId: targetUserId, swipeeId: swiperId, type: 'LIKE' }
                });
            }

            else {
                const reciprocalSwipe = await prisma.swipe.findUnique({
                    where: {
                        swiperId_swipeeId: {
                            swiperId: targetUserId,
                            swipeeId: swiperId
                        }
                    }
                });

                if (reciprocalSwipe && reciprocalSwipe.type === 'LIKE') {
                    isMatch = true;
                }
            }

            if (isMatch) {

                const existingConv = await prisma.conversation.findFirst({
                    where: {
                        AND: [
                            { participants: { some: { userId: swiperId } } },
                            { participants: { some: { userId: targetUserId } } }
                        ]
                    }
                });

                if (existingConv) {
                    conversationId = existingConv.id;
                } else {

                    const newConv = await prisma.conversation.create({
                        data: {
                            participants: {
                                create: [
                                    { userId: swiperId },
                                    { userId: targetUserId }
                                ]
                            }
                        }
                    });
                    conversationId = newConv.id;
                }
            }
        }

        return APIResponseOK(res, true, 'Aksi swipe berhasil diproses.', {
            isMatch,
            conversationId,
            action
        });

    } catch (error) {
        console.error('Gagal memproses aksi swipe:', error);
        return APIResponseErr(res, false, 'Terjadi kesalahan sistem saat memproses swipe.', null);
    }
});