import User from "../repositories/User.repository.js";
import Inventory from "../repositories/Inventory.repository.js";
import Item from "../repositories/Item.repository.js";
import { getRandomDropItems } from "../utils/random.js";

class BlockService {
    async addTaps(userId, slug, count) {
        try {
            let user = await User.findById(userId);

            // Якщо користувача не знайдено — повертаємо 404
            if (!user) return { success: false, message: "User not found", status: 404 };

            // Шукаємо всередині Юзера блок по слагу
            const blockToTap = user.tapBlocks.find(block => block.slug === slug)
            // Якщо блока нема то користувач його не купив або по ньому неможна тапати = 400
            if (!blockToTap || !blockToTap.canTap) return { success: false, message: "Block is invalid", status: 400 };
            // збільшує баланс юзера на +1
            user = await User.incrementBalance(user._id, count)

            // Шукаємо предмет у базі за slug по якому тапаэм
            const tapItem = await Item.findBySlug(slug);
            // Перевіряємо, чи існує предмет і чи його можна "тапати"
            if (!tapItem || !tapItem.canTap || !Array.isArray(tapItem.canDrop) || !tapItem.canDrop.length === 0)
                return { success: false, message: "Item can't be tapped", status: 400 };

            // Вибираємо дроп за шансом
            const drop = getRandomDropItems(tapItem.canDrop);
            if (!drop) return { success: false, message: "No drops available", status: 400 };

            // Додаємо обраний предмет до інвентаря
            await Inventory.addItem(user._id, drop.itemId, 1);
            const updatedUser = await User.findById(userId)
            console.log(updatedUser)
            return {
                success: true, message: `+${count} ${drop}`, status: 200, user: updatedUser
            }
        } catch (error) {
            throw error
        }
    }

    async buyBlock(slug, telegramId) {
        try {
            // Шукаємо користувача за telegramId
            let user = await User.findByTelegramId(telegramId);
            console.log(user)
            // Якщо користувача не знайдено — повертаємо 404
            if (!user) return { success: false, message: "User not found", status: 404 };

            const blockToBuy = await Item.findBySlug(slug)
            console.log(blockToBuy)
            if (!blockToBuy || !blockToBuy.canTap || blockToBuy.type !== "block") return { success: false, message: "Block is not defined", status: 400 };

            const userHasBlock = user.tapBlocks.find(block => block.slug === slug)
            console.log(userHasBlock)
            if (userHasBlock) return { success: false, message: "User already has block", status: 400 };

            if (user.balance < blockToBuy.price) return { success: false, message: "You don`t have money", status: 400 };

            user = await User.addTapBlock(user._id, blockToBuy._id)

            user = await User.decrementBalance(user._id, blockToBuy.price)

            return { success: true, status: 200, block: blockToBuy, message: "Successfull" }

        } catch (error) {
            throw error
        }


    }

    // Повертає всі блоки
    async getAllBlocks() {
        try {
            const blocks = await Item.findAllBlocks();
            if (!Array.isArray(blocks) || blocks.length === 0) return { success: false, message: "Block not found", status: 404 };
            return { success: true, blocks, status: 200 };
        } catch (error) {
            throw error;
        }
    }

    // Повертає блок за slug
    async getBlockBySlug(slug) {
        try {
            const block = await Item.findBySlug(slug);
            if (!block) return { success: false, message: "Block not found", status: 404 };
            return { success: true, block, status: 200 };
        } catch (error) {
            throw error;
        }
    }



    async getFirst(userId) {
        try {

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

        } catch (error) {
            throw error
        }


    }

    async getUserBlocks(userId) {
        try {
            const user = await User.findById(userId);

            // Якщо користувача не знайдено — повертаємо 404
            if (!user) return { success: false, message: "User not found", status: 404 };

            const blocks = user.tapBlocks

            if (!Array.isArray(blocks) || blocks.length === 0) return { success: false, message: "Block not found", status: 404 };

            return { success: true, blocks, status: 200 };

        } catch (error) {
            throw error;
        }

    }
}

const blockService = new BlockService()

export default blockService