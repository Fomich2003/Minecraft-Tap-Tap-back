import { rollDailyLoot } from "../data/daily-loot.js";
import { levelFromXp } from "../data/experience.js";
import { dailyAward, describeUpgrade, upgradeCost } from "../data/upgrades.js";
import Inventory from "../repositories/Inventory.repository.js";
import User from "../repositories/User.repository.js";
import catalogService from "./catalog.service.js";
import inventoryService from "./inventory.service.js";
import loadoutService from "./loadout.service.js";
import questService from "./quest.service.js";

const LANGUAGE_CODE = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/;

class UserService {

    async getUserById(userId) {
        try {
            const user = await User.findById(userId)

            if (!user) return { success: false, message: "Користувача не знайдено", status: 404 };

            return { success: true, user, status: 200 };

        } catch (error) {
            return { success: false, message: error.message, status: 500 };
        }
    }

    async claimAward(userId) {
        try {
            const current = await User.findById(userId)
            if (!current) return { success: false, message: "Користувача не знайдено", status: 404 };
            const updatedUser = await User.claimAward(userId, dailyAward(current.tapLevel ?? 0))
            if (updatedUser) {
                await questService.track(updatedUser, { awards: 1 });
                const loot = rollDailyLoot(levelFromXp(current.xpTotal));
                const { itemBySlug } = await catalogService.get();
                await Inventory.addItems(userId, loot.map(({ slug, quantity }) => ({ item: itemBySlug.get(slug), quantity })).filter(entry => entry.item));
                const inventory = await Inventory.findByUserId(userId);
                return { success: true, user: updatedUser, status: 200, message: "Нагороду отримано", loot, inventory };
            }

            const user = await User.findById(userId)
            if (!user) return { success: false, message: "Користувача не знайдено", status: 404 };

            return { success: false, user, status: 400, message: "Нагорода ще не готова" };
        } catch (error) {
            return { success: false, message: error.message, status: 500 };
        }
    }

    // Скидає всі монети і назавжди додає монети за тап на всіх блоках. Інвентар не змінюється.
    async upgradeTap(userId) {
        const user = await User.findById(userId)
        if (!user) return { success: false, message: "Користувача не знайдено", status: 404 };

        const level = user.tapLevel ?? 0
        const cost = upgradeCost(level)
        if (user.balance < cost) return { success: false, message: "Недостатньо монет", status: 400 };

        const updated = await User.purchaseTapUpgrade(userId, level, cost)
        if (!updated) return { success: false, message: "Покращення вже застосовано, онови сторінку", status: 409 };

        const { loadout } = await loadoutService.forUser(userId)
        return { success: true, status: 200, balance: updated.balance, upgrade: describeUpgrade(updated.tapLevel), loadout };
    }

    // Вішає копію банера: предмет лишається в інвентарі, його можна переробити далі
    async setProfileBanner(userId, stackId) {
        const inventory = await Inventory.findPlainByUserId(userId);
        const stack = stackId ? inventory?.items.id(String(stackId)) : null;
        const { itemById } = await catalogService.get();
        const item = stack && itemById.get(stack.itemId.toString());
        if (!item?.slug.endsWith("_banner")) return { success: false, message: "Цей предмет не можна використати", status: 400 };

        const banner = { base: item.slug.replace(/_banner$/, ""), patterns: stack.components?.banner_patterns ?? [] };
        await User.setProfileBanner(userId, banner);
        return { success: true, status: 200, profileBanner: banner };
    }

    async setLanguage(userId, language) {
        if (typeof language !== "string" || !LANGUAGE_CODE.test(language)) return { success: false, message: "Некоректна мова", status: 400 };
        await User.setLanguage(userId, language)
        return { success: true, status: 200 };
    }

    // Створює профіль під час першого входу. Для наявних користувачів лише оновлює дані з Telegram
    async getFullUserInfoByTG(tgUser) {
        let user = await User.upsertFromTelegram(tgUser.user)
        const [catalog, foundInventory] = await Promise.all([catalogService.get(), Inventory.findPlainByUserId(user._id)])
        // Книга знань з будь-якого джерела застосовується сама
        const book = catalog.itemBySlug.get("knowledge_book")
        if (book && foundInventory?.items.some(stack => stack.itemId.equals(book._id))) {
            await Inventory.mutate(user._id, entries => {
                entries.items = entries.items.filter(stack => !stack.itemId.equals(book._id))
            })
            await User.setKnowledge(user._id)
            user = { ...user, knowledge: true }
        }
        const inventory = await inventoryService.getInventory(user._id)
        const plainInventory = await Inventory.findPlainByUserId(user._id)
        const loadout = loadoutService.describe(user, plainInventory, catalog)
        return { user: { ...user, photo: tgUser.user.photo_url ?? null, upgrade: describeUpgrade(user.tapLevel ?? 0), loadout, questsReady: questService.readyCount(user) }, inventory };
    }
}

const userService = new UserService()

export default userService
