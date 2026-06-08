import { Server } from 'socket.io';
import redisClient from '../config/redis.js';
import prisma from '../config/database.js';
import { messaging } from '../config/firebase.js';

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

        await redisClient.hSet('users:online', socket.userId, socket.id);

        socket.on('send_message', async (data) => {
            const { conversationId, receiverId, content, type } = data;

            if (!conversationId || !receiverId || !content) {
                return;
            }

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
                                profile: { select: { name: true } }
                            }
                        }
                    }
                });

                await prisma.conversation.update({
                    where: { id: conversationId },
                    data: { updatedAt: new Date() }
                });

                const receiverSocketId = await redisClient.hGet('users:online', receiverId);

                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('receive_message', newMessage);
                    console.log(`[Soket] Pesan terkirim secara real-time ke user ${receiverId}`);
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
                                body: type === 'IMAGE' ? '🖼️ Mengirim sebuah gambar' : content
                            },
                            data: {
                                type: 'NEW_CHAT_MESSAGE',
                                conversationId: conversationId,
                                senderId: socket.userId
                            }
                        }).catch(err => console.error('Gagal mengirim FCM Chat Notification:', err.message));
                    }
                    console.log(`[FCM] User ${receiverId} offline. Simulasi notifikasi push dipicu.`);
                }

                socket.emit('message_delivered', { messageId: newMessage.id, conversationId });

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
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) throw new Error('Socket.IO belum diinisialisasi!');
    return io;
};