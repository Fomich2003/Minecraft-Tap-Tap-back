import User from "../repositories/User.repository.js";
import inventoryService from "./inventory.service.js";

class UserService {

    async createUser(userData) {
        try {
            const user = await User.create(userData);
            if (!user) return { success: false, message: "User not created", status: 500 };
            return { success: true, user, status: 201 };
        } catch (error) {
            throw error;
        }
    }

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
            const user = await User.findById(userId)

            if (!user) return { success: false, message: "User not found", status: 404 };
            // ... (решта claimAward не показана на скріншоті — без змін)
        } catch (error) {
            return { success: false, message: error.message, status: 500 };
        }
    }


    async getFullUserInfoByTG(tgUser) {
        try {
            console.log("getFullUserInfoByTG - tgUser", tgUser)
            const tgUserId = tgUser.user.id
            let resultUser = await this.getUserByTelegramId(tgUserId)
            const exInventory = await inventoryService.getInventory(resultUser.user._id)
            resultUser.user.photo = tgUser.user.photo_url
            const user = resultUser.user.toObject
                ? resultUser.user.toObject()
                : resultUser.user;

            if (!user || !exInventory) return null;

            return {
                ...user,
                photo: tgUser.user.photo_url,
                inventory: exInventory.inventory
            };
        } catch (error) {
            return { success: false, message: error.message, status: 500 };
        }
    }
}

const userService = new UserService()

export default userService