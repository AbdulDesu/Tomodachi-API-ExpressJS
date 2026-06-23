import prisma from '../config/database.js';
import redisClient from '../config/redis.js';
import {APIResponseOK, APIResponseErr, APIResponseBR, handleErrorAsync} from '../helper/api.js';
import { messaging } from '../config/firebase.js';
import {getIO} from "../sockets/index.js";
import {generateBotReply} from "../helper/gemini.js";

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
            },
            _count: {
                select: {
                    messages: {
                        where: {
                            isRead: false,
                            senderId: { not: currentUserId }
                        }
                    }
                }
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

        const unreadCount = conv._count?.messages || 0;

        const isOnline = !!onlineSocketIds[index];

        return {
            conversationId: conv.id,
            updatedAt: conv.updatedAt,
            unreadCount: unreadCount,
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
    const { conversationId, receiverId, caption } = req.body;

    if (!conversationId || !receiverId) {
        return APIResponseBR(res, false, 'conversationId dan receiverId wajib diisi.', null);
    }

    if (!req.file) {
        return APIResponseBR(res, false, 'File media tidak ditemukan.', null);
    }

    const fileUrl = req.file.filename;

    let mediaType = 'IMAGE';
    let notifBody="📸 Sent an image";

    if (req.file.mimetype.startsWith('audio/')) {
        mediaType = 'AUDIO';
        notifBody = '🎤 Mengirim pesan suara';
    } else if (caption) {
        notifBody = `📸 ${caption}`;
    }

    try {
        const receiverUser = await prisma.user.findUnique({
            where: { id: receiverId },
            include: { profile: true }
        });

        if (!receiverUser) return APIResponseBR(res, false, 'Penerima tidak valid.', null);

        const newMessage = await prisma.message.create({
            data: { conversationId, senderId, content: fileUrl, type: 'IMAGE', caption: mediaType === 'AUDIO' ? null : (caption || null)},
            include: { sender: { select: { profile: { select: { name: true } } } } }
        });

        await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() }
        });

        const io = getIO();
        const receiverSocketId = await redisClient.hGet('users:online', receiverId);



        if (receiverSocketId) {
            io.to(receiverSocketId).emit('receive_message', newMessage);
        } else if (!receiverUser.isBot && receiverUser.fcmToken && messaging) {
            messaging.send({
                token: receiverUser.fcmToken,
                notification :{
                    title: newMessage.sender.profile?.name || 'New Messages',
                    body: notifBody
                },
                data: {
                    type: 'NEW_CHAT_MESSAGE',
                    conversationId,
                    senderId,
                }   }).catch(err => console.error('Gagal FCM:', err.message));
        }

        if (receiverUser.isBot) {
            await (async () => {
                try {
                    const senderSocketId = await redisClient.hGet('users:online', senderId);

                    await prisma.message.updateMany({
                        where: { conversationId, senderId: senderId, isRead: false },
                        data: { isRead: true }
                    });

                    if (senderSocketId) {
                        io.to(senderSocketId).emit('messages_marked_as_read', {
                            conversationId,
                            readerId: receiverId
                        });

                        io.to(senderSocketId).emit('user_typing', {
                            senderId: receiverId,
                            conversationId,
                            isTyping: true
                        });
                    }

                    await new Promise(resolve => setTimeout(resolve, 1500));

                    const history = await prisma.message.findMany({
                        where: {conversationId},
                        orderBy: {createdAt: 'desc'},
                        take: 6,
                        select: {content: true, senderId: true, type: true, caption: true}
                    });
                    history.reverse();

                    const aiResponseText = await generateBotReply({...receiverUser.profile, id: receiverId}, history);

                    const botMessage = await prisma.message.create({
                        data: {conversationId, senderId: receiverId, content: aiResponseText, type: 'TEXT'},
                        include: {sender: {select: {profile: {select: {name: true}}}}}
                    });

                    await prisma.conversation.update({
                        where: {id: conversationId},
                        data: {updatedAt: new Date()}
                    });

                    if (senderSocketId) {
                        io.to(senderSocketId).emit('user_typing', {
                            senderId: receiverId,
                            conversationId,
                            isTyping: false
                        });
                        io.to(senderSocketId).emit('receive_message', botMessage);
                    }

                } catch (botError) {
                    console.error("Gagal AI Gambar:", botError);
                    const senderSocketId = await redisClient.hGet('users:online', senderId);
                    if (senderSocketId) io.to(senderSocketId).emit('user_typing', {
                        senderId: receiverId,
                        conversationId,
                        isTyping: false
                    });
                }
            })();
        }

        return APIResponseOK(res, true, 'Gambar berhasil diunggah dan dikirim.', newMessage);

    } catch (error) {
        console.error('Gagal memproses upload media chat:', error);
        return APIResponseErr(res, false, 'Terjadi kesalahan sistem saat mengirim gambar.', null);
    }
};