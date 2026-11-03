import { validate } from "@telegram-apps/init-data-node"

const INIT_DATA_TTL_SECONDS = 24 * 60 * 60

// Гравець з підписаних даних. parse() бібліотеки вимагає поле signature,
// якого старіші клієнти Telegram не надсилають, хоча підпис hash у них правильний
function readUser(initDataRaw) {
    const raw = new URLSearchParams(initDataRaw).get("user")
    if (!raw) return null
    const user = JSON.parse(raw)
    return Number.isSafeInteger(user?.id) && user.id > 0 ? user : null
}

// Перевірка підпису за офіційним алгоритмом Telegram (HMAC-SHA256 від токена бота) і строку дії auth_date
function verifyTelegram(initDataRaw) {
    try {
        validate(initDataRaw, process.env.BOT_TOKEN, { expiresIn: INIT_DATA_TTL_SECONDS })
        const user = readUser(initDataRaw)
        return user ? { valid: true, user } : null
    } catch {
        return null
    }
}

export default verifyTelegram
