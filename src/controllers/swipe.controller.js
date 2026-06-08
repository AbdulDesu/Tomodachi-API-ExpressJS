import prisma from '../config/database.js';
import { APIResponseOK, APIResponseBR, APIResponseErr } from '../helper/api.js';

export const processSwipe = async (req, res) => {
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
};