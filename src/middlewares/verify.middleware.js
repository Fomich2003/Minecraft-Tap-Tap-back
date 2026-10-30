import verifyTelegram from "../utils/crypto.js";
import User from "../repositories/User.repository.js";
import { SERVER_CONF } from "../config/server.config.js";

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

// Тунель (ngrok) теж приходить з localhost, але додає x-forwarded-for
function isLocalRequest(req) {
    return !req.headers["x-forwarded-for"] && LOOPBACK_ADDRESSES.has(req.socket.remoteAddress);
}

async function checkTgProfile(req, res, next) {

    try {
        if (SERVER_CONF.mode === "development" && isLocalRequest(req)) {
            const tgUser = {
                user: {
                    photo_url: "example.jpg",
                    id: SERVER_CONF.testUserTgId
                }
            }
            const user = await User.findByTelegramId(SERVER_CONF.testUserTgId)
            if (user) req.user = user
            req.tgUser = tgUser
            return next()
        }

        if (!req.body) return res.status(400).json({ success: false, message: "Body is required" })
        const tgData = req.body.telegramData
        if (!tgData) return res.status(400).json({ success: false, message: "tgData is required" })

        const tgUser = verifyTelegram(tgData)
        if (!tgUser) return res.status(401).json({ success: false, message: "tgUser invalid" })
        const user = await User.findByTelegramId(tgUser.user.id)
        if (user) req.user = user
        req.tgUser = tgUser
        next()
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export { checkTgProfile }
