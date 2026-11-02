import cardService from "../services/card.service.js";

const handle = action => async (req, res) => {
    try {
        if (!req.user) return res.status(400).json({ success: false, message: "Користувача не знайдено" });
        const result = await action(req);
        return res.status(result.status).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const listCards = handle(req => cardService.list(req.user));
const setDeck = handle(req => cardService.setDeck(req.user, req.body?.deck));

export { listCards, setDeck };
