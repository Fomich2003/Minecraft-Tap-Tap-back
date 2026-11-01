import mobService from "../services/mob.service.js";

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

const listMobs = handle(async req => mobService.list(req.user));
const buyMob = handle(req => mobService.buy(req.user, req.body?.slug));
const summonBoss = handle(req => mobService.summon(req.user, req.body?.slug));
const hitMob = handle(req => mobService.hit(req.user._id, req.body?.slug, req.body?.count));

export { listMobs, buyMob, summonBoss, hitMob };
