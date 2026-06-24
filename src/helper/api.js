const sendResponse = (res, statusCode, isOk, message, data) => {
    return res.status(statusCode).json({
        success: isOk,
        message: message,
        data: data
    });
};

export const APIResponseOK = (res, isOk, message, data) => {
    return sendResponse(res, 200, isOk, message, data);
};

export const APIResponseUnAuth = (res, isOk, message, data) => {
    return sendResponse(res, 401, isOk, message, data);
};

export const APIResponseErr = (res, isOk, message, data = null) => {
    return sendResponse(res, 500, isOk, message, data);
};

export const APIResponseNF = (res, isOk, message, data) => {
    return sendResponse(res, 404, isOk, message, data);
};

export const APIResponseBR = (res, isOk, message, data) => {
    return sendResponse(res, 400, isOk, message, data);
};

export const isEmptyObj = (obj) => {
    if (!obj) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;

    return false;
};