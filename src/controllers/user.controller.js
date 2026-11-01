import loadoutService from "../services/loadout.service.js";
import userService from "../services/user.service.js";

async function getUserProfile(req, res) {
    try {
        const tgUser = req.tgUser

        if (!tgUser) return res.status(400).json({ success: false, message: "Не вдалося підтвердити акаунт Telegram" });

        const userData = await userService.getFullUserInfoByTG(tgUser)

        return res.status(200).json({
            success: true,
            message: "Data success",
            ...userData
        });
    } catch (error) {
        // Виводимо помилку в консоль і повертаємо 500 статус сервера
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
}


async function claimUserAward(req, res) {

    try {
        const user = req.user

        if (!user) return res.status(400).json({ success: false, message: "Користувача не знайдено" });
        const resultAward = await userService.claimAward(user._id)
        return res.status(resultAward.status).json(resultAward);

    } catch (error) {
        // Виводимо помилку в консоль і повертаємо 500 статус сервера
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }

}
async function upgradeUserTap(req, res) {
    try {
        if (!req.user) return res.status(400).json({ success: false, message: "Користувача не знайдено" });
        const result = await userService.upgradeTap(req.user._id)
        return res.status(result.status).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Спільна обгортка дій зі спорядженням: усі вони потребують уже створеного профілю
const withUser = action => async (req, res) => {
    try {
        if (!req.user) return res.status(400).json({ success: false, message: "Користувача не знайдено" });
        const result = await action(req);
        return res.status(result.status).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getEquipment = withUser(req => loadoutService.overview(req.user._id));
const equipTool = withUser(req => loadoutService.equip(req.user, req.body?.stackId, req.body?.kind));
const consumeItem = withUser(req => loadoutService.consume(req.user, req.body?.stackId));
const setProfileBanner = withUser(req => userService.setProfileBanner(req.user._id, req.body?.stackId));
const setUserLanguage = withUser(req => userService.setLanguage(req.user._id, req.body?.language));

export { getUserProfile, claimUserAward, upgradeUserTap, getEquipment, equipTool, consumeItem, setUserLanguage, setProfileBanner }
