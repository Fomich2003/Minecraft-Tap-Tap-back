import { validate, parse } from "@telegram-apps/init-data-node"

function verifyTelegram(initDataRaw) {

    try {
        validate(initDataRaw, process.env.BOT_TOKEN, { expiresIn: 0 })
        const parsed = parse(initDataRaw)
        return { valid: true, user: parsed.user }
    } catch (err) {
        return { valid: false, user: null }
    }
}

export default verifyTelegram