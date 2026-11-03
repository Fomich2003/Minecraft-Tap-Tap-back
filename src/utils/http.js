// Спільна відповідь на непередбачену помилку. Технічний текст (Mongo, стек) лишається в журналі сервера:
// гравцеві він нічого не скаже, а зловмисникові підкаже будову бази.
export const GENERIC_ERROR = "Ой! Щось пішло не так, спробуйте пізніше...";

// Власні повідомлення сервісів написані українською і є ключами перекладу, їх можна показувати
const CYRILLIC = /[а-яіїєґ]/i;

export function publicMessage(error) {
    const message = typeof error?.message === "string" ? error.message : "";
    return CYRILLIC.test(message) ? message : GENERIC_ERROR;
}

export function sendServerError(res, error) {
    console.error(error);
    if (res.headersSent) return;
    res.status(500).json({ success: false, message: publicMessage(error) });
}

// Обгортка контролера: сервіс повертає { status, ... }, а будь-який виняток стає охайною відповіддю 500
export const handle = (action, { needsUser = true } = {}) => async (req, res) => {
    try {
        if (needsUser && !req.user) return res.status(400).json({ success: false, message: "Користувача не знайдено" });
        const result = await action(req, res);
        if (!res.headersSent) res.status(result.status).json(result);
    } catch (error) {
        sendServerError(res, error);
    }
};
