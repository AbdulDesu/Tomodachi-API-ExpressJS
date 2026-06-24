import { RtcTokenBuilder, RtcRole } from 'agora-token';

import {APIResponseOK, APIResponseErr, APIResponseBR} from '../helper/api.js';

export const generateCallToken = async (req, res) => {
    const { conversationId } = req.body;
    const currentUserId = req.user.id;

    if (!conversationId) {
        return APIResponseBR(res, false, 'conversationId wajib dikirim.');
    }

    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
        return APIResponseErr(res, false, 'Konfigurasi Agora di server belum diatur.');
    }

    const role = RtcRole.PUBLISHER;
    const expirationTimeInSeconds = 3600;

    const token = RtcTokenBuilder.buildTokenWithAccount(
        appId,
        appCertificate,
        conversationId,
        currentUserId,
        role,
        expirationTimeInSeconds,
        expirationTimeInSeconds
    );

    return APIResponseOK(res, true, 'Token panggilan berhasil di-generate', {
        token: token,
        channelName: conversationId,
        uid: currentUserId
    });
};