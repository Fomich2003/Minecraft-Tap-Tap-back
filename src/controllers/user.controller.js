import userService from "../services/user.service.js";

async function getUserProfile(req, res) {
    try {
        const tgUser = req.tgUser

        if (!tgUser) return res.status(400).json({ success: false, message: "TgUser is invalid" });

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

        if (!user) return res.status(400).json({ success: false, message: "user is invalid" });
        const resultAward = await userService.claimAward(user._id)
        return res.status(resultAward.status).json(resultAward);

    } catch (error) {
        // Виводимо помилку в консоль і повертаємо 500 статус сервера
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }

}
export { getUserProfile, claimUserAward }
