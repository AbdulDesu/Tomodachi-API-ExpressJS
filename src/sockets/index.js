import { Server } from 'socket.io';
import redisClient from '../config/redis.js';
import prisma from '../config/database.js';
import { messaging } from '../config/firebase.js';

import { generateBotReply } from '../helper/gemini.js';

let io;

export const initializeSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || '*',
            methods: ['GET', 'POST']
        }
    });

    io.use((socket, next) => {
        const userId = socket.handshake.auth.userId;
        if (!userId) {
            return next(new Error('Autentikasi soket gagal: userId tidak ditemukan.'));
        }
        socket.userId = userId;
        next();
    });

    io.on('connection', async (socket) => {
        console.log(`[Soket] User aktif: ${socket.userId} (${socket.id})`);

        await redisClient.hSet('users:online', socket.userId, socket.id );

        socket.broadcast.emit('user_status_changed', { userId: socket.userId, isOnline: true });

        socket.on('check_online_status', async (data) => {
            const { targetId } = data;
            if (!targetId) return;

            const targetSocketId = await redisClient.hGet('users:online', targetId);

            socket.emit('online_status', {
                userId: targetId,
                isOnline: !!targetSocketId
            });
        });

        socket.on('send_message', async (data) => {
            const { conversationId, receiverId, content, type, localId } = data;

            if (!conversationId || !receiverId || !content) return;
            try {
                const newMessage = await prisma.message.create({
                    data: {
                        conversationId,
                        senderId: socket.userId,
                        content,
                        type: type || 'TEXT'
                    },
                    include: {
                        sender: {
                            select: {
                                profile: {
                                    select: { name: true, photoUrl: true }
                                }
                            }
                        }
                    }
                });

                await prisma.conversation.update({
                    where: { id: conversationId },
                    data: { updatedAt: new Date() }
                });

                const receiverUser = await prisma.user.findUnique({
                    where: { id: receiverId },
                    include: { profile: true }
                });

                if (!receiverUser) return;

                const receiverSocketId = await redisClient.hGet('users:online', receiverId);

                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('receive_message', newMessage);
                } else {
                    if (!receiverUser.isBot && receiverUser.fcmToken && messaging) {
                        messaging.send({
                            token: receiverUser.fcmToken,
                            notification: {
                                title: newMessage.sender.profile?.name || 'Pesan Baru',
                                body: content
                            },
                            android: {
                                notification: {
                                    channelId: 'tomodachi_messages_channel'
                                }
                            },
                            data: {
                                type: 'NEW_CHAT_MESSAGE',
                                conversationId: String(conversationId),
                                senderId: String(socket.userId),
                                targetName: newMessage.sender.profile?.name,
                                senderPhotoUrl: newMessage.sender.profile?.photoUrl
                            }
                        }).then((response) => {
                            console.log('[DEBUG FCM] Sukses dikirim ke Google Server! Response:', response);
                        }).catch(err => {
                            console.error('[DEBUG FCM] Gagal dikirim ke Google:', err.message);
                        });
                    }
                }

                socket.emit('message_delivered', {
                    messageId: newMessage.id,
                    conversationId,
                    localId: localId
                });

                if (receiverUser.isBot) {
                    await prisma.message.updateMany({
                        where: {
                            conversationId,
                            senderId: socket.userId,
                            isRead: false
                        },
                        data: { isRead: true }
                    });

                    socket.emit('messages_marked_as_read', {
                        conversationId,
                        readerId: receiverId
                    });

                    socket.emit('user_typing', {
                        senderId: receiverId,
                        conversationId,
                        isTyping: true
                    });

                    await (async () => {
                        try {
                            await new Promise(resolve => setTimeout(resolve, 1500));


                            const history = await prisma.message.findMany({
                                where: { conversationId },
                                orderBy: { createdAt: 'desc' },
                                take: 6,
                                select: { content: true, senderId: true, type: true }
                            });
                            history.reverse();

                            const aiResponseText = await generateBotReply(
                                { ...receiverUser.profile, id: receiverId },
                                history
                            );

                            const botMessage = await prisma.message.create({
                                data: {
                                    conversationId,
                                    senderId: receiverId,
                                    content: aiResponseText,
                                    type: 'TEXT'
                                },
                                include: {sender: {select: {profile: {select: {name: true}}}}}
                            });

                            socket.emit('user_typing', {
                                senderId: receiverId,
                                conversationId,
                                isTyping: false
                            });

                            socket.emit('receive_message', botMessage);

                        } catch (aiError) {
                            console.error("Gagal memproses balasan Bot AI:", aiError);
                            socket.emit('user_typing', {senderId: receiverId, conversationId, isTyping: false});
                        }
                    })();
                }

            } catch (error) {
                console.error('Gagal memproses pengiriman pesan via soket:', error);
            }
        });

        socket.on('typing', async (data) => {
            const { receiverId, conversationId, isTyping } = data;
            const receiverSocketId = await redisClient.hGet('users:online', receiverId);

            if (receiverSocketId) {
                io.to(receiverSocketId).emit('user_typing', {
                    senderId: socket.userId,
                    conversationId,
                    isTyping
                });
            }
        });

        socket.on('read_messages', async (data) => {
            const { conversationId, senderId } = data;

            try {
                await prisma.message.updateMany({
                    where: {
                        conversationId,
                        senderId: senderId,
                        isRead: false
                    },
                    data: { isRead: true }
                });

                const senderSocketId = await redisClient.hGet('users:online', senderId);
                if (senderSocketId) {
                    io.to(senderSocketId).emit('messages_marked_as_read', {
                        conversationId,
                        readerId: socket.userId
                    });
                }
            } catch (error) {
                console.error('Gagal memperbarui status baca pesan:', error);
            }
        });

        socket.on('disconnect', async () => {
            console.log(`[Soket] User terputus: ${socket.userId}`);
            await redisClient.hDel('users:online', socket.userId);
            socket.broadcast.emit('user_status_changed', { userId: socket.userId, isOnline: false });
        });

        socket.on('initiate_call', async (data) => {
            const { receiverId, conversationId, callType } = data;

            try {
                const receiverUser = await prisma.user.findUnique({
                    where: { id: receiverId },
                    select: { isBot: true, fcmToken: true }
                });

                if (!receiverUser) {
                    socket.emit('call_rejected', { conversationId, reason: 'Pengguna tidak ditemukan.' });
                    return;
                }

                if (receiverUser.isBot) {
                    socket.emit('call_rejected', {
                        conversationId,
                        reason: 'Only real user allowed to do call'
                    });
                    return;
                }

                const callerInfo = await prisma.user.findUnique({
                    where: { id: socket.userId },
                    select: { profile: { select: { name: true, photoUrl: true } } }
                });

                const receiverSocketId = await redisClient.hGet('users:online', receiverId);

                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('incoming_call', {
                        callerId: socket.userId,
                        callerName: callerInfo?.profile?.name || 'Seseorang',
                        callerPhoto: callerInfo?.profile?.photoUrl || null,
                        conversationId,
                        callType
                    });
                } else {
                    if (receiverUser.fcmToken && messaging) {
                        messaging.send({
                            token: receiverUser.fcmToken,
                            data: {
                                type: 'INCOMING_CALL',
                                callerId: socket.userId,
                                callerName: callerInfo?.profile?.name || 'Seseorang',
                                conversationId,
                                callType
                            }
                        }).catch(err => console.error('Gagal FCM Call:', err.message));
                    } else {
                        socket.emit('call_rejected', { conversationId, reason: 'OFFLINE' });
                    }
                }
            } catch (error) {
                console.error('Gagal initiate_call:', error);
            }
        });

        socket.on('accept_call', async (data) => {
            const { callerId, conversationId } = data;

            const callerSocketId = await redisClient.hGet('users:online', callerId);

            if (callerSocketId) {
                io.to(callerSocketId).emit('call_accepted', {
                    receiverId: socket.userId,
                    conversationId
                });
            }
        });

        socket.on('reject_call', async (data) => {
            const { targetId, conversationId, reason } = data;

            const targetSocketId = await redisClient.hGet('users:online', targetId);

            if (targetSocketId) {
                io.to(targetSocketId).emit('call_rejected', {
                    conversationId,
                    reason: reason || 'DECLINED'
                });
            }
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) throw new Error('Socket.IO belum diinisialisasi!');
    return io;
};