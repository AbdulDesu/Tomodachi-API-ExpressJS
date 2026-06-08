import express from 'express';
import http from 'http';
import {APIResponseErr} from "./helper/api.js";
import {connectRedis} from "./config/redis.js";
import {initializeSocket} from "./sockets/index.js";

import authRoutes from "./routes/auth.route.js";
import profileRoutes from "./routes/profile.route.js";
import discoverRoutes from "./routes/discover.route.js";
import swipeRoutes from "./routes/swipe.route.js";
import chatRoutes from "./routes/chat.routes.js";

const PORT = process.env.PORT || 705;
const app = express();

const httpServer = http.createServer(app);

app.use(express.json());

app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/discover', discoverRoutes);
app.use('/swipe', swipeRoutes)
app.use('/chat', chatRoutes)

function errorHandler(err, req, res, _) {
    console.error(err.stack);
    APIResponseErr(res, false, err.toString(), null)
}

function clientErrorHandler(err, req, res, next) {
    if (req.xhr) {
        console.error(err.stack);
        APIResponseErr(res, false, err.toString(), null)
    } else {
        next(err);
    }
}

function logErrors(err, req, res, next) {
    APIResponseErr(res, false, err.toString(), null)
    console.error(err.stack)
    next(err);
}

app.use(errorHandler);
app.use(clientErrorHandler);
app.use(logErrors);



const startServer = async () => {
    await connectRedis();

    initializeSocket(httpServer);

    httpServer.listen(PORT, () => {
        console.log(`Server Tomodachi (HTTP & WebSocket) sudah berjalan di port ${PORT}`);
    });
};

startServer().then(_ => {})