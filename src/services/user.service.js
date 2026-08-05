import User from "../repositories/User.repository.js";

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

            const lastAwardTime = user.lastAwardTime
            const currentTime = new Date()
            const diff = currentTime - lastAwardTime

            if (!lastAwardTime || diff > 24 * 60 * 60 * 1000) {
                const updatedUser = await User.claimAward(userId)
                console.log("[claimAward]", updatedUser)
                return { success: true, user: updatedUser, status: 200, message: "Award has been claimed!" };
            }

            return { success: false, user, status: 200, message: "Award is not ready!" };



        } catch (error) {
            return { success: false, message: error.message, status: 500 };
        }
    }


    async getUserByTelegramId(tgUserId) {
        try {
            const user = await User.findByTelegramId(tgUserId)

            if (!user) return { success: false, message: "User not found", status: 404 };

            return { success: true, user, status: 200 };

        } catch (error) {
            return { success: false, message: error.message, status: 500 };
        }

    }
}

const userService = new UserService()

export default userService