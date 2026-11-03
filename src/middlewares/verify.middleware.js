import verifyTelegram from "../utils/crypto.js";
import User from "../repositories/User.repository.js";
import { SERVER_CONF } from "../config/server.config.js";
import { sendServerError } from "../utils/http.js";
import { createRateLimiter } from "./security.middleware.js";

const NO_ACCOUNT = "Не вдалося підтвердити акаунт Telegram";
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
// Підписані дані Telegram займають близько пів кілобайта. Довший рядок не перевіряється взагалі
const MAX_INIT_DATA_LENGTH = 8192;

// Заголовки, які додає будь-який проксі чи тунель (ngrok, Cloudflare, nginx)
const PROXY_HEADERS = ["x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "forwarded", "x-real-ip", "cf-connecting-ip", "x-original-host"];

// Ліміт на гравця, а не на адресу: через ngrok усі запити приходять з однієї адреси тунелю.
// Черга тапів шле до запиту на секунду, тож 240 за хвилину лишають великий запас для звичайної гри.
export const playerLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 240, keyOf: req => req.tgUser?.user?.id ?? null });

const hostName = host => String(host ?? "").replace(/:\d+$/, "").toLowerCase();

// Тестовий вхід без підпису лише для запиту з цієї ж машини напряму, без тунелю.
// Живий сервер працює в режимі development через ngrok: тунель приходить з localhost,
// тому перевіряються і заголовки проксі, і адреса, на яку звертався браузер.
export function isLocalRequest(req) {
    if (PROXY_HEADERS.some(name => req.headers[name] !== undefined)) return false;
    if (Object.keys(req.headers).some(name => name.startsWith("ngrok-") && name !== "ngrok-skip-browser-warning")) return false;
    return LOOPBACK_ADDRESSES.has(req.socket.remoteAddress) && LOCAL_HOSTS.has(hostName(req.headers.host));
}

async function checkTgProfile(req, res, next) {
    try {
        if (SERVER_CONF.mode === "development" && isLocalRequest(req)) {
            const tgUser = { user: { photo_url: "example.jpg", id: SERVER_CONF.testUserTgId } };
            const user = await User.findByTelegramId(SERVER_CONF.testUserTgId);
            if (user) req.user = user;
            req.tgUser = tgUser;
            return next();
        }

        const tgData = req.body?.telegramData;
        if (typeof tgData !== "string" || !tgData || tgData.length > MAX_INIT_DATA_LENGTH) {
            return res.status(401).json({ success: false, message: NO_ACCOUNT });
        }

        const tgUser = verifyTelegram(tgData);
        if (!tgUser) return res.status(401).json({ success: false, message: NO_ACCOUNT });
        const user = await User.findByTelegramId(tgUser.user.id);
        if (user) req.user = user;
        req.tgUser = tgUser;
        playerLimiter(req, res, next);
    } catch (error) {
        sendServerError(res, error);
    }
}

export { checkTgProfile };
