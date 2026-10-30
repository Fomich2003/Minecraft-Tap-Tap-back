import User from "../repositories/User.repository.js";
import Inventory from "../repositories/Inventory.repository.js";
import Item from "../repositories/Item.repository.js";
import { getRandomDropItems } from "../utils/random.js";
import catalogService from "./catalog.service.js";
import userService from "./user.service.js";

const TAPS_PER_SECOND = 20;
const TAP_BURST = 120;
const MAX_TAP_ATTEMPTS = 12;

class BlockService {
    async addTaps(userId, slug, count) {
        const requested = Number(count);
        if (!Number.isSafeInteger(requested) || requested < 1) {
            return { success: false, message: "Tap count is invalid", status: 400 };
        }

        const user = await User.findById(userId);
        // Якщо користувача не знайдено — повертаємо 404
        if (!user) return { success: false, message: "User not found", status: 404 };

        // Шукаємо всередині Юзера блок по слагу
        const blockToTap = user.tapBlocks.find(block => block.slug === slug)
        // Якщо блока нема то користувач його не купив або по ньому неможна тапати = 400
        if (!blockToTap || !blockToTap.canTap) return { success: false, message: "Block is invalid", status: 400 };

        const { itemBySlug, itemById } = await catalogService.get();
        const tapItem = itemBySlug.get(slug);
        if (!tapItem?.canTap || !tapItem.canDrop?.length) return { success: false, message: "Item can't be tapped", status: 400 };

        const applied = await this.spendTapTokens(userId, slug, requested, tapItem);
        if (!applied) return { success: false, message: "Занадто швидко", status: 429 };

        const drops = [];
        for (let index = 0; index < applied.brokenBlocks; index += 1) {
            const drop = getRandomDropItems(tapItem.canDrop);
            const item = drop && itemById.get(drop.itemId.toString());
            if (item) drops.push({ item, quantity: 1 });
        }
        if (drops.length) await Inventory.addItems(userId, drops);

        const updatedUser = await User.findById(userId);
        const inventory = drops.length ? await Inventory.findByUserId(userId) : undefined;
        return {
            success: true, status: 200, user: updatedUser, inventory, acceptedTaps: applied.taps,
            drops: drops.map(({ item }) => item.slug), message: `+${applied.taps}`,
        };
    }

    // Швидкість тапів рахує сервер: клієнт не може виписати собі довільну кількість монет
    async spendTapTokens(userId, slug, requested, tapItem) {
        for (let attempt = 0; attempt < MAX_TAP_ATTEMPTS; attempt += 1) {
            const user = await User.findTapState(userId);
            const now = Date.now();
            const lastTapAt = user.lastTapAt ? user.lastTapAt.getTime() : now - TAP_BURST / TAPS_PER_SECOND * 1000;
            const tokens = Math.min(TAP_BURST, (user.tapTokens ?? TAP_BURST) + (now - lastTapAt) / 1000 * TAPS_PER_SECOND);
            const taps = Math.min(requested, Math.floor(tokens));
            if (taps < 1) return null;

            const progress = (user.tapProgress?.get(slug) ?? 0) + taps;
            const perBlock = Math.max(1, tapItem.tapsToBreak ?? 1);
            const updated = await User.applyTaps(userId, user.lastTapAt, {
                taps, tokens: tokens - taps, now: new Date(now), slug, progress: progress % perBlock,
            });
            if (updated) return { taps, brokenBlocks: Math.floor(progress / perBlock) };
            await new Promise(resolve => setTimeout(resolve, Math.random() * 20 * (attempt + 1)));
        }
        return null;
    }

    async buyBlock(slug, userId, tgUser) {
        const user = await User.findById(userId);
        // Якщо користувача не знайдено — повертаємо 404
        if (!user) return { success: false, message: "User not found", status: 404 };

        const blockToBuy = await Item.findBySlug(slug)
        if (!blockToBuy || !blockToBuy.canTap) return { success: false, message: "Block can't be bought", status: 400 };

        const userHasBlock = user.tapBlocks.find(block => block.slug === slug)
        if (userHasBlock) return { success: false, message: "User already has block", status: 400 };

        const purchased = await User.purchaseTapBlock(user._id, blockToBuy._id, blockToBuy.price)
        if (!purchased) return { success: false, message: "You don't have enough balance", status: 400 };

        const userData = await userService.getFullUserInfoByTG(tgUser)

        return { success: true, status: 200, block: blockToBuy, user: userData.user, message: "Successfull" }
    }

    // Повертає всі блоки
    async getAllBlocks() {
        const blocks = await Item.findAllBlocks();
        if (!Array.isArray(blocks) || blocks.length === 0) return { success: false, message: "Block not found", status: 404 };
        return { success: true, blocks, status: 200 };
    }

    async getBlocksToTap() {
        const blocks = await Item.findBlocksToTap();
        if (!Array.isArray(blocks) || blocks.length === 0) return { success: false, status: 404 }
        return { success: true, blocks, status: 200 };
    }

    // Повертає блок за slug
    async getBlockBySlug(slug) {
        const block = await Item.findBySlug(slug);
        if (!block) return { success: false, message: "Block not found", status: 404 };
        return { success: true, block, status: 200 };
    }

    async getFirst(userId) {
        // Шукаємо користувача за telegramId
        let user = await User.findById(userId);

        // Якщо користувача не знайдено — повертаємо 404
        if (!user) return { success: false, message: "User not found", status: 404 };

        const firstBlock = await Item.getFirst()

        if (!firstBlock) return { success: false, message: "Block is not defined", status: 400 };

        const userHasBlock = user.tapBlocks.find(block => block.slug === firstBlock.slug)

        if (userHasBlock) return { success: false, message: "User already has block", status: 400 };

        user = await User.addTapBlock(user._id, firstBlock._id)

        return { success: true, status: 200, block: firstBlock, user, message: "Successfull" }
    }

    async getUserBlocks(userId) {
        const user = await User.findById(userId);

        // Якщо користувача не знайдено — повертаємо 404
        if (!user) return { success: false, message: "User not found", status: 404 };

        const blocks = user.tapBlocks

        if (!Array.isArray(blocks) || blocks.length === 0) return { success: false, message: "Block not found", status: 404 };

        return { success: true, blocks, status: 200 };
    }
}

const blockService = new BlockService()

export default blockService
