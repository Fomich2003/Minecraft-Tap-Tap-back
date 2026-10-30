import User from "../repositories/User.repository.js";
import inventoryService from "./inventory.service.js";

class UserService {

    async getUserById(userId) {
        try {
            const user = await User.findById(userId)

            if (!user) return { success: false, message: "User not found", status: 404 };

            return { success: true, user, status: 200 };

        } catch (error) {
            return { success: false, message: error.message, status: 500 };
        }
    }

    async claimAward(userId) {
        try {
            const updatedUser = await User.claimAward(userId)
            if (updatedUser) return { success: true, user: updatedUser, status: 200, message: "Award has been claimed!" };

            const user = await User.findById(userId)
            if (!user) return { success: false, message: "User not found", status: 404 };

            return { success: false, user, status: 400, message: "Award is not ready!" };
        } catch (error) {
            return { success: false, message: error.message, status: 500 };
        }
    }

    // Створює профіль під час першого входу. Для наявних користувачів лише оновлює дані з Telegram
    async getFullUserInfoByTG(tgUser) {
        const user = await User.upsertFromTelegram(tgUser.user)
        const inventory = await inventoryService.getInventory(user._id)
        return { user: { ...user, photo: tgUser.user.photo_url ?? null }, inventory };
    }
}

const userService = new UserService()

export default userService
