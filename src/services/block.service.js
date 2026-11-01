import { baseDropChance, dropChance, dropsPerBlock, toPercent } from "../data/drops.js";
import { blockXp, levelFromXp } from "../data/experience.js";
import { locationOf } from "../data/locations.js";
import { activeEffects, coinsWithEffects, toolRepairPerDrop } from "../data/effects.js";
import { blockToolKind, isOreBlock } from "../data/tools.js";
import { coinsPerTap } from "../data/upgrades.js";
import User from "../repositories/User.repository.js";
import Inventory from "../repositories/Inventory.repository.js";
import Item from "../repositories/Item.repository.js";
import { addInventoryQuantity } from "../utils/inventory-stacks.js";
import { tapBlockPrice } from "../data/tap-blocks.js";
import { getRandomDropItems } from "../utils/random.js";
import catalogService from "./catalog.service.js";
import loadoutService, { equippedTool, tapPower, wearTool } from "./loadout.service.js";
import questService from "./quest.service.js";
import userService from "./user.service.js";

const TAPS_PER_SECOND = 20;
const TAP_BURST = 120;
const MAX_TAP_ATTEMPTS = 12;
// Покинутий блок загоюється: клієнт за цей час уже стирає тріщини
const PROGRESS_RESET_MS = 5000;

const FORTUNE_EXTRA_ITEM = .15;

// Спершу вирішується, чи блок щось дав. Шовковий дотик забирає сам блок, а фортуна ще й додає предмети з руд
function rollDrops(tapItem, brokenBlocks, tool, effects, itemById) {
    const silkTouch = tool?.enchantments.silk_touch;
    const fortune = isOreBlock(tapItem.slug) ? tool?.enchantments.fortune ?? 0 : 0;
    const chance = dropChance(tapItem.slug, tool, effects);
    const drops = new Map();
    let missed = 0;

    for (let index = 0; index < brokenBlocks; index += 1) {
        const amount = dropsPerBlock(chance);
        if (!amount) {
            missed += 1;
            continue;
        }
        const drop = silkTouch ? null : getRandomDropItems(tapItem.canDrop);
        const item = silkTouch ? tapItem : drop && itemById.get(drop.itemId.toString());
        if (!item) continue;
        const entry = drops.get(item.slug) ?? { item, quantity: 0 };
        entry.quantity += amount + (!silkTouch && Math.random() < fortune * FORTUNE_EXTRA_ITEM ? 1 : 0);
        drops.set(item.slug, entry);
    }
    return { drops: [...drops.values()], missed };
}

// Кожен зламаний блок коштує 1 міцності. Міцність рятує від зносу, регенерація його повертає
export function toolWear(tool, brokenBlocks, effects) {
    const saveChance = 1 - 1 / ((tool.enchantments.unbreaking ?? 0) + 1);
    let wear = 0;
    for (let index = 0; index < brokenBlocks; index += 1) {
        if (Math.random() >= saveChance) wear += 1;
    }
    return wear - brokenBlocks * toolRepairPerDrop(effects);
}

class BlockService {
    async addTaps(userId, slug, count) {
        const requested = Number(count);
        if (!Number.isSafeInteger(requested) || requested < 1) {
            return { success: false, message: "Некоректна кількість тапів", status: 400 };
        }

        const user = await User.findById(userId);
        // Якщо користувача не знайдено — повертаємо 404
        if (!user) return { success: false, message: "Користувача не знайдено", status: 404 };

        // Шукаємо всередині Юзера блок по слагу
        const blockToTap = user.tapBlocks.find(block => block.slug === slug)
        // Якщо блока нема то користувач його не купив або по ньому неможна тапати = 400
        if (!blockToTap || !blockToTap.canTap) return { success: false, message: "Цей блок недоступний", status: 400 };

        const catalog = await catalogService.get();
        const { itemBySlug, itemById } = catalog;
        const tapItem = itemBySlug.get(slug);
        if (!tapItem?.canTap || !tapItem.canDrop?.length) return { success: false, message: "По цьому блоку не можна тапати", status: 400 };

        const effects = activeEffects(user);
        const tool = equippedTool(user, await Inventory.findPlainByUserId(userId), blockToolKind(slug), catalog);
        const power = tapPower(slug, tapItem.tapsToBreak, tool, effects);

        const applied = await this.spendTapTokens(userId, slug, requested, tapItem, power, effects);
        if (!applied) return { success: false, message: "Занадто швидко", status: 429 };

        const { drops, missed } = rollDrops(tapItem, applied.brokenBlocks, tool, effects, itemById);
        const wear = tool ? toolWear(tool, applied.brokenBlocks, effects) : 0;
        let toolBroken = false;
        if (drops.length || wear) {
            await Inventory.mutate(userId, inventory => {
                for (const { item, quantity } of drops) addInventoryQuantity(inventory, item, quantity);
                toolBroken = wear ? wearTool(inventory, tool, wear) : false;
            });
        }

        const dropped = drops.reduce((sum, { quantity }) => sum + quantity, 0);
        const gainedXp = (applied.brokenBlocks - missed) * blockXp(slug);
        if (gainedXp > 0) await User.addXp(userId, gainedXp);
        await questService.track(user, {
            taps: applied.taps, coins: applied.coins, broken: applied.brokenBlocks, drops: dropped, ores: isOreBlock(slug) ? dropped : 0,
        });

        const { user: updatedUser, loadout } = await loadoutService.forUser(userId);
        const inventory = drops.length || wear ? await Inventory.findByUserId(userId) : undefined;
        return {
            success: true, status: 200, user: updatedUser, inventory, loadout, acceptedTaps: applied.taps,
            drops: drops.map(({ item, quantity }) => ({ slug: item.slug, quantity })), missed,
            toolBroken: toolBroken ? tool.slug : null, message: `+${applied.coins}`, questsReady: questService.readyCount(updatedUser),
        };
    }

    // Швидкість тапів рахує сервер: клієнт не може виписати собі довільну кількість монет
    async spendTapTokens(userId, slug, requested, tapItem, power, effects, { keepProgress = false } = {}) {
        for (let attempt = 0; attempt < MAX_TAP_ATTEMPTS; attempt += 1) {
            const user = await User.findTapState(userId);
            const now = Date.now();
            const lastTapAt = user.lastTapAt ? user.lastTapAt.getTime() : now - TAP_BURST / TAPS_PER_SECOND * 1000;
            const tokens = Math.min(TAP_BURST, (user.tapTokens ?? TAP_BURST) + (now - lastTapAt) / 1000 * TAPS_PER_SECOND);
            const taps = Math.min(requested, Math.floor(tokens));
            if (taps < 1) return null;

            const idle = user.lastTapAt && now - user.lastTapAt.getTime() > PROGRESS_RESET_MS;
            const progress = (idle && !keepProgress ? 0 : user.tapProgress?.get(slug) ?? 0) + taps * power;
            const perBlock = Math.max(1, tapItem.tapsToBreak ?? 1);
            const coins = taps * coinsWithEffects(coinsPerTap(user.tapLevel ?? 0), effects);
            const updated = await User.applyTaps(userId, user.lastTapAt, user.tapLevel ?? 0, {
                coins, tokens: tokens - taps, now: new Date(now), slug, progress: progress % perBlock,
            });
            if (updated) return { taps, coins, brokenBlocks: Math.floor(progress / perBlock) };
            await new Promise(resolve => setTimeout(resolve, Math.random() * 20 * (attempt + 1)));
        }
        return null;
    }

    async buyBlock(slug, userId, tgUser) {
        const user = await User.findById(userId);
        // Якщо користувача не знайдено — повертаємо 404
        if (!user) return { success: false, message: "Користувача не знайдено", status: 404 };

        const blockToBuy = await Item.findBySlug(slug)
        if (!blockToBuy || !blockToBuy.canTap) return { success: false, message: "Цей блок не продається", status: 400 };

        const { level } = locationOf(slug);
        if (levelFromXp(user.xpTotal) < level) return { success: false, message: "Потрібен рівень досвіду {level}", params: { level }, status: 403 };

        const userHasBlock = user.tapBlocks.find(block => block.slug === slug)
        if (userHasBlock) return { success: false, message: "Цей блок уже є у тебе", status: 400 };

        const purchased = await User.purchaseTapBlock(user._id, blockToBuy._id, tapBlockPrice(slug, blockToBuy.price))
        if (!purchased) return { success: false, message: "Недостатньо монет", status: 400 };

        const userData = await userService.getFullUserInfoByTG(tgUser)

        return { success: true, status: 200, block: blockToBuy, user: userData.user, message: "Блок куплено" }
    }

    // Повертає всі блоки
    async getAllBlocks() {
        const blocks = await Item.findAllBlocks();
        if (!Array.isArray(blocks) || blocks.length === 0) return { success: false, message: "Цей блок недоступний", status: 404 };
        return { success: true, blocks, status: 200 };
    }

    async getBlocksToTap() {
        const blocks = await Item.findBlocksToTap();
        if (!Array.isArray(blocks) || blocks.length === 0) return { success: false, status: 404 }
        return { success: true, blocks: blocks
            .map(block => ({ ...block.toObject(), price: tapBlockPrice(block.slug, block.price), dropChance: toPercent(baseDropChance(block.slug)), location: locationOf(block.slug) }))
            .sort((left, right) => left.location.level - right.location.level || left.price - right.price), status: 200 };
    }

    // Повертає блок за slug
    async getBlockBySlug(slug) {
        const block = await Item.findBySlug(slug);
        if (!block) return { success: false, message: "Цей блок недоступний", status: 404 };
        return { success: true, block, status: 200 };
    }

    async getFirst(userId) {
        // Шукаємо користувача за telegramId
        let user = await User.findById(userId);

        // Якщо користувача не знайдено — повертаємо 404
        if (!user) return { success: false, message: "Користувача не знайдено", status: 404 };

        const firstBlock = await Item.getFirst()

        if (!firstBlock) return { success: false, message: "Стартовий блок не налаштовано", status: 400 };

        const userHasBlock = user.tapBlocks.find(block => block.slug === firstBlock.slug)

        if (userHasBlock) return { success: false, message: "Цей блок уже є у тебе", status: 400 };

        user = await User.addTapBlock(user._id, firstBlock._id)

        return { success: true, status: 200, block: firstBlock, user, message: "Блок отримано" }
    }

    async getUserBlocks(userId) {
        const user = await User.findById(userId);

        // Якщо користувача не знайдено — повертаємо 404
        if (!user) return { success: false, message: "Користувача не знайдено", status: 404 };

        const blocks = user.tapBlocks

        if (!Array.isArray(blocks) || blocks.length === 0) return { success: false, message: "Цей блок недоступний", status: 404 };

        return { success: true, blocks, status: 200 };
    }
}

const blockService = new BlockService()

export default blockService
