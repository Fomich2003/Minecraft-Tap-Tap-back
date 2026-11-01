import { notifyPlayer } from "../bot/notify.js";
import { rollDailyLoot } from "../data/daily-loot.js";
import { levelFromXp } from "../data/experience.js";
import { dailyAward } from "../data/upgrades.js";
import Inventory from "../repositories/Inventory.repository.js";
import User from "../repositories/User.repository.js";
import catalogService from "./catalog.service.js";

const REFERRAL_CODE = /^ref_([0-9a-f]{24})$/;
const INVITER_AWARDS = 2;
const FRIEND_AWARDS = 1;

// Нагорода росте з рівнем запрошувача, як і щоденна: інакше після кількох покращень вона нічого не варта
const inviterCoins = level => dailyAward(level) * INVITER_AWARDS;
const friendCoins = () => dailyAward(0) * FRIEND_AWARDS;

async function giveChest(userId, xpLevel) {
    const { itemBySlug } = await catalogService.get();
    const entries = rollDailyLoot(xpLevel).map(({ slug, quantity }) => ({ item: itemBySlug.get(slug), quantity })).filter(entry => entry.item);
    await Inventory.ensureExists(userId);
    await Inventory.addItems(userId, entries);
}

class ReferralService {
    describe(user) {
        return { inviterCoins: inviterCoins(user.tapLevel ?? 0), friendCoins: friendCoins() };
    }

    // Запис створюється лише для того, хто ще ні разу не заходив у гру. Тому старий гравець не стане «новим другом», а себе запросити неможливо
    async register(tgUser, payload) {
        const code = payload?.match(REFERRAL_CODE)?.[1];
        if (!code) return false;
        const inviter = await User.findById(code);
        if (!inviter) return false;
        return await User.createReferred(tgUser, inviter._id);
    }

    // Нагорода видається за вхід у гру, а не за натискання /start: без підпису Telegram друга не зарахує ніхто
    async settle(user) {
        if (!user.referredBy || user.referralPaid) return user;
        try {
            const claimed = await User.claimReferral(user._id, friendCoins());
            if (!claimed) return user;
            await giveChest(user._id, 0);
            await this.rewardInviter(user);
            return { ...user, balance: claimed.balance, referralPaid: true };
        } catch (error) {
            // Збій нагороди не має заважати другу зайти в гру
            console.log("[referral]", error.message);
            return user;
        }
    }

    async rewardInviter(friend) {
        const inviter = await User.findById(friend.referredBy);
        if (!inviter) return;
        const coins = inviterCoins(inviter.tapLevel ?? 0);
        await User.addReferral(inviter._id, coins);
        await giveChest(inviter._id, levelFromXp(inviter.xpTotal));
        const name = friend.firstName || friend.username || "A friend";
        await notifyPlayer(inviter.telegramId, `${name} joined Minecraft Tap-Tap with your link! You got ${coins} coins and a chest of items.`);
    }
}

export default new ReferralService();
