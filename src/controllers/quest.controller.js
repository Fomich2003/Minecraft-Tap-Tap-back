import questService from "../services/quest.service.js";

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

const listQuests = handle(req => questService.overview(req.user));
const claimQuest = handle(req => questService.claim(req.user, req.body?.id));

export { listQuests, claimQuest };
