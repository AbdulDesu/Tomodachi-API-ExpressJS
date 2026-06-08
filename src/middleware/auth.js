import jwt from 'jsonwebtoken';
import {} from '../config/config.js';
import {APIResponseOK, APIResponseBR, APIResponseErr, APIResponseUnAuth} from '../helper/api.js';

export const verifyToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return APIResponseUnAuth(res, false, "A token is required for authentication");
    }

    try {
        req.user = jwt.verify(token, config.jwtSecret);
        return next();

    } catch (err) {
        return APIResponseUnAuth(res, false, "Invalid or Expired Token");
    }
};