import jwt from 'jsonwebtoken';
import {APIResponseOK, APIResponseBR, APIResponseErr, APIResponseUnAuth} from '../helper/api.js';
import config from '../config/config.js';

export const verifyToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return APIResponseUnAuth(res, false, "A token is required for authentication");
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = {
            id: decoded.userId
        };
        return next();

    } catch (err) {
        return APIResponseUnAuth(res, false, "Invalid or Expired Token");
    }
};