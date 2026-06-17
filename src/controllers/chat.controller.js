import prisma from '../config/database.js';
import redisClient from '../config/redis.js';
import {APIResponseOK, APIResponseErr, APIResponseBR, handleErrorAsync} from '../helper/api.js';
import { messaging } from '../config/firebase.js';
import {getIO} from "../sockets/index.js";

export const getChatList = handleErrorAsync(async (req, res) => {
    const currentUserId = req.user.id;

    const conversations = await prisma.conversation.findMany({
        where: {
            participants: {
                some: {
                    userId: currentUserId
                }
            }
        },
        include: {
            participants: {
                include: {
                    user: {
                        include: {
                            profile: {
                                select: {
                                    name: true,
                                    photoUrl: true
                                }
                            }
                        }
                    }
                }
            },
            messages: {
                orderBy: {
                    createdAt: 'desc'
                },
                take: 1
            }
        },
        orderBy: {
            updatedAt: 'desc'
        }
    });

    if (conversations.length === 0) {
        return APIResponseOK(res, true, 'Belum ada obrolan aktif.', []);
    }

    const otherUserIds = conversations.map(conv => {
        const otherParticipant = conv.participants.find(p => p.userId !== currentUserId);
        return otherParticipant ? otherParticipant.userId : null;
    }).filter(Boolean);

    let onlineSocketIds = [];
    if (otherUserIds.length > 0) {
        onlineSocketIds = await redisClient.hmGet('users:online', otherUserIds);
    }

    const formattedChatList = conversations.map((conv, index) => {
        const otherParticipant = conv.participants.find(p => p.userId !== currentUserId);
        const lastMessageObj = conv.messages[0] || null;

        const isOnline = !!onlineSocketIds[index];

        return {
            conversationId: conv.id,
            updatedAt: conv.updatedAt,
            partner: otherParticipant ? {
                userId: otherParticipant.user.id,
                name: otherParticipant.user.profile?.name || 'Pengguna Tomodachi',
                photoUrl: otherParticipant.user.profile?.photoUrl || null,
                isBot: otherParticipant.user.isBot,
                isOnline: isOnline
            } : null,
            lastMessage: lastMessageObj ? {
                content: lastMessageObj.content,
                type: lastMessageObj.type,
                senderId: lastMessageObj.senderId,
                createdAt: lastMessageObj.createdAt,
                isRead: lastMessageObj.isRead
            } : null
        };
    });

    return APIResponseOK(res, true, 'Berhasil memuat daftar obrolan.', formattedChatList);
});

export const getChatHistory = async (req, res) => {
    const { conversationId } = req.params;

    const cursor = req.query.cursor;
    const limit = parseInt(req.query.limit) || 20;

    const conversation = await prisma.conversation.findFirst({
        where: {
            id: conversationId,
            participants: { some: { userId: req.user.id } }
        }
    });

    if (!conversation) {
        return APIResponseBR(res, false, 'Akses ditolak atau ruang obrolan tidak ditemukan.', null);
    }

    const messages = await prisma.message.findMany({
        where: { conversationId: conversationId },
        take: limit,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: {
            createdAt: 'desc'
        },
        include: {
            sender: { select: { id: true, profile: { select: { name: true } } } }
        }
    });

    const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null;

    return APIResponseOK(res, true, 'Berhasil memuat riwayat pesan.', {
        messages,
        nextCursor
    });
};

export const uploadMediaMessage = async (req, res) => {
    const senderId = req.user.id;
    const { conversationId, receiverId } = req.body;

    if (!conversationId || !receiverId) {
        return APIResponseBR(res, false, 'conversationId dan receiverId wajib diisi.', null);
    }

    if (!req.file) {
        return APIResponseBR(res, false, 'File gambar tidak ditemukan.', null);
    }

    const imageUrl = req.file.filename;

    try {
        const newMessage = await prisma.message.create({
            data: {
                conversationId,
                senderId,
                content: imageUrl,
                type: 'IMAGE'
            },
            include: {
                sender: { select: { profile: { select: { name: true } } } }
            }
        });

        await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() }
        });

        const io = getIO();
        const receiverSocketId = await redisClient.hGet('users:online', receiverId);

        if (receiverSocketId) {

            io.to(receiverSocketId).emit('receive_message', newMessage);
            console.log(`[HTTP->Socket] Gambar terkirim real-time ke user ${receiverId}`);
        } else {

            const receiverUser = await prisma.user.findUnique({
                where: { id: receiverId },
                select: { fcmToken: true }
            });

            if (receiverUser && receiverUser.fcmToken && messaging) {
                messaging.send({
                    token: receiverUser.fcmToken,
                    notification: {
                        title: newMessage.sender.profile?.name || 'Pesan Baru',
                        body: '🖼️ Mengirim sebuah gambar'
                    },
                    data: {
                        type: 'NEW_CHAT_MESSAGE',
                        conversationId: conversationId,
                        senderId: senderId
                    }
                }).catch(err => console.error('Gagal mengirim FCM Image Notification:', err.message));
            }
        }

        return APIResponseOK(res, true, 'Gambar berhasil diunggah dan dikirim.', newMessage);

    } catch (error) {
        console.error('Gagal memproses upload media chat:', error);
        return APIResponseErr(res, false, 'Terjadi kesalahan sistem saat mengirim gambar.', null);
    }
};