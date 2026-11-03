// Звідки браузер може звертатися до API. Підпис Telegram однаково перевіряється на кожен запит,
// а список лише не дає стороннім сайтам ганяти API з браузера гравця.
// CORS_ORIGINS у .env додає адреси через кому, а "*" повертає старий режим «усім».
const DEFAULT_ORIGINS = ["https://tap-tap.fomka.online"];
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const VERCEL_PREVIEW = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;

export function originAllowed(origin, extra = []) {
    // Запити без Origin (curl, сервер-сервер, той самий сайт) CORS не стосується
    if (!origin) return true;
    if (extra.includes("*")) return true;
    return DEFAULT_ORIGINS.includes(origin) || extra.includes(origin) || LOCAL_ORIGIN.test(origin) || VERCEL_PREVIEW.test(origin);
}

export function corsOptions(env = process.env) {
    const extra = String(env.CORS_ORIGINS ?? "").split(",").map(entry => entry.trim()).filter(Boolean);
    return {
        origin: (origin, callback) => callback(null, originAllowed(origin, extra)),
        methods: ["GET", "POST"],
        maxAge: 600,
    };
}
