import userService from "../services/user.service.js";
import inventoryService from "../services/inventory.service.js";
import has24HoursPassed from "../utils/convertTime.js"

async function registerUser(req, res) {
    try {

        if (!req.body) return res.status(400).json({ success: false, message: "Body is invalid" });

        const { telegramId, username } = req.body;

        // Перевірка наявності telegramId
        if (!telegramId)
            return res.status(400).json({ success: false, message: "TelegramId invalid" });

        // Перевірка наявності username 
        if (!username)
            return res.status(400).json({ success: false, message: "Username invalid" });

        //resultUser = { success: true, user, status: 201 }
        const resultUser = await userService.createUser({ telegramId, username })

        // resultInventory = { success: true, inventory, status: 201 };
        const resultInventory = await inventoryService.createInventory(resultUser.user._id)

        if (!resultUser.success || !resultInventory.success) {
            return res.status(500).json({ success: false, message: `${resultUser.message}, ${resultInventory.message}` });
        }

        return res.status(resultUser.status).json(resultUser);

    } catch (error) {
        // Виводимо помилку в консоль і повертаємо 500 статус сервера
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
}

async function getUserProfile(req, res) {

    try {
        const tgUser = req.tgUser
        if (!tgUser) return res.status(400).json({ success: false, message: "TgUser is invalid" });
        const tgUserId = tgUser.user.id
        let resultUser = await userService.getUserByTelegramId(tgUserId)
        if (!resultUser.success && resultUser.status === 404) {
            resultUser = await userService.createUser({ telegramId: tgUserId, username: tgUser.user.username });

            // resultInventory = { success: true, inventory, status: 201 };
            const resultInventory = await inventoryService.createInventory(resultUser.user._id);

            if (!resultUser.success || !resultInventory.success) {
                return res.status(500).json({ success: false, message: `${resultUser.message}, ${resultInventory.message}` });
            }
        }
        const exInventory = await inventoryService.getInventory(resultUser.user._id)
        resultUser.user.photo = tgUser.user.photo_url
        const user = resultUser.user.toObject
            ? resultUser.user.toObject()
            : resultUser.user;

        console.log({
            ...resultUser,
            user: {
                ...user,
                photo: tgUser.user.photo_url,
                inventory: exInventory.inventory
            }
        })

        return res.status(resultUser.status).json({
            ...resultUser,
            user: {
                ...user,
                photo: tgUser.user.photo_url,
                inventory: exInventory.inventory
            },
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
        if (user.lastAwardTime && !has24HoursPassed(user.lastAwardTime)) return res.status(404).json({ success: false, message: "The time hasn't come yet" });
        const resultAward = await userService.claimAward(user._id)
        return res.status(resultAward.status).json(resultAward);

    } catch (error) {
        // Виводимо помилку в консоль і повертаємо 500 статус сервера
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }

}
export { registerUser, getUserProfile, claimUserAward }