import prisma from '../config/database.js';
import {APIResponseBR, APIResponseOK, handleErrorAsync} from "../helper/api.js";
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
        return prisma.$queryRaw`
            SELECT p.id  AS "profileId",
                   p."userId",
                   p.name,
                   p."photoUrl",
                   p.bio,
                   p.tags,
                   p.birthdate,
                   u."isBot",
                   ROUND((ST_DistanceSphere(p.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)) 
                          1000):: numeric, 1) AS "distanceKm"
            FROM "Profile" p
                     INNER JOIN "User" u ON p."userId" = u.id
            WHERE p."userId" != ${userId}

              AND u.id NOT IN (
                SELECT "swipeeId" FROM "Swipe" WHERE "swiperId" = ${userId}
                )

              AND (p.gender = CAST (${preferredGender} AS "Gender")
               OR ${preferredGender} IS NULL)

              AND ST_DWithin(
                p.location::geography
                , ST_SetSRID(ST_MakePoint(${lng}
                , ${lat})
                , 4326)::geography
                , ${radiusInMeters}
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