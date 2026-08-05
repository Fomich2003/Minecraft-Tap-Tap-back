import verifyTelegram from "../utils/crypto.js";
import User from "../repositories/User.repository.js";

async function checkTgProfile(req, res, next) {

    try {
        if (!req.body) return res.status(400).json({ success: false, message: "Body is required" })
        const tgData = req.body.telegramData
        console.log(tgData)
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