// Захист на вході API: тіло запиту без операторів Mongo і обмеження частоти запитів

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_DEPTH = 8;

// Ключ на кшталт {"slug": {"$ne": null}} перетворив би рядок у запит до бази.
// Жоден маршрут гри не приймає такі ключі, тому запит відхиляється цілком.
export function findUnsafeKey(value, depth = 0) {
    if (value === null || typeof value !== "object") return null;
    if (depth > MAX_DEPTH) return "depth";
    for (const key of Object.keys(value)) {
        if (key.startsWith("$") || FORBIDDEN_KEYS.has(key)) return key;
        const nested = findUnsafeKey(value[key], depth + 1);
        if (nested) return nested;
    }
    return null;
}

export function rejectUnsafeInput(req, res, next) {
    if (findUnsafeKey(req.body) || findUnsafeKey(req.params)) {
        return res.status(400).json({ success: false, message: "Некоректний запит" });
    }
    next();
}

// Ліміт у пам'яті процесу: сервер один, тож зовнішнє сховище не потрібне.
// Фіксоване вікно: простий лічильник на ключ, старі ключі прибираються таймером.
export function createRateLimiter({ windowMs, max, keyOf, message = "Забагато запитів, зачекай трохи" }) {
    const hits = new Map();

    const sweep = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
    }, windowMs);
    sweep.unref?.();

    const limiter = (req, res, next) => {
        const key = keyOf(req);
        if (key === null || key === undefined) return next();

        const now = Date.now();
        let entry = hits.get(key);
        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(key, entry);
        }
        entry.count += 1;

        if (entry.count > max) {
            res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
            return res.status(429).json({ success: false, message });
        }
        next();
    };
    limiter.reset = () => hits.clear();
    limiter.stop = () => clearInterval(sweep);
    return limiter;
}
