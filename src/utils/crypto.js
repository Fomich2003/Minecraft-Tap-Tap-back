import { validate, parse } from "@telegram-apps/init-data-node"

const INIT_DATA_TTL_SECONDS = 24 * 60 * 60

function verifyTelegram(initDataRaw) {

    try {
        validate(initDataRaw, process.env.BOT_TOKEN, { expiresIn: INIT_DATA_TTL_SECONDS })
        const parsed = parse(initDataRaw)
        if (!parsed.user?.id) return null
        return { valid: true, user: parsed.user }
    } catch {
        return null
    }
}

export default verifyTelegram
