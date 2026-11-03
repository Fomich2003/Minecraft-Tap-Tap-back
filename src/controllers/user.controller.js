import leaderboardService from "../services/leaderboard.service.js";
import loadoutService from "../services/loadout.service.js";
import userService from "../services/user.service.js";
import { handle, sendServerError } from "../utils/http.js";

async function getUserProfile(req, res) {
    try {
        if (!req.tgUser) return res.status(401).json({ success: false, message: "Не вдалося підтвердити акаунт Telegram" });
        const userData = await userService.getFullUserInfoByTG(req.tgUser)
        return res.status(200).json({ success: true, message: "Data success", ...userData });
    } catch (error) {
        sendServerError(res, error);
    }
}

const claimUserAward = handle(req => userService.claimAward(req.user._id));
const upgradeUserTap = handle(req => userService.upgradeTap(req.user._id));
const getEquipment = handle(req => loadoutService.overview(req.user._id));
const equipTool = handle(req => loadoutService.equip(req.user, req.body?.stackId, req.body?.kind));
const consumeItem = handle(req => loadoutService.consume(req.user, req.body?.stackId));
const setProfileBanner = handle(req => userService.setProfileBanner(req.user._id, req.body?.stackId));
const setUserLanguage = handle(req => userService.setLanguage(req.user._id, req.body?.language));
const getLeaderboard = handle(req => leaderboardService.top(req.user, req.body?.metric));

export { getUserProfile, claimUserAward, upgradeUserTap, getEquipment, equipTool, consumeItem, setUserLanguage, setProfileBanner, getLeaderboard }
