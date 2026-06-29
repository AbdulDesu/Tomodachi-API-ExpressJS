import agoraToken from 'agora-token';
const { RtcTokenBuilder, RtcRole } = agoraToken;

import {APIResponseOK, APIResponseErr, APIResponseBR} from '../helper/api.js';

export const generateCallToken = async (req, res) => {
    const { conversationId } = req.params;

    if (!conversationId) {
        return APIResponseBR(res, false, 'conversationId wajib dikirim.');
    }

    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
        return APIResponseErr(res, false, 'Konfigurasi Agora di server belum diatur.');
    }

    const uid = 0;
    const role = RtcRole.PUBLISHER;

    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        conversationId,
        uid,
        role,
        privilegeExpiredTs,
        privilegeExpiredTs
    );

    return APIResponseOK(res, true, 'Token panggilan berhasil di-generate', {
        token: token,
        channelName: conversationId,
        uid: uid
    });
};