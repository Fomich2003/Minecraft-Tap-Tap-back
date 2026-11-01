import Inventory from "../repositories/Inventory.repository.js";
import User from "../repositories/User.repository.js";
import { describeXp, recycleXp } from "../data/experience.js";
import { bookPrice, potionPrice } from "../data/pricing.js";
import { maxStackSize, removeInventoryQuantity } from "../utils/inventory-stacks.js";
import catalogService from "./catalog.service.js";
import loadoutService from "./loadout.service.js";
import questService from "./quest.service.js";

const fail = (status, message) => ({ success: false, status, message });

const DEFAULT_POTION = { potion: "water" };
const POTION_ITEMS = new Set(["potion", "splash_potion", "lingering_potion"]);
const POTION_FORMS = [["potion", 1], ["splash_potion", 1.3], ["lingering_potion", 1.6]];
const KNOWLEDGE_BOOK = "knowledge_book";
const MAX_STACKS_AT_ONCE = 64 * 36;
const MAX_PURCHASE = 64;

function validQuantity(value, limit = MAX_STACKS_AT_ONCE) {
    const quantity = Number(value);
    return Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= limit ? quantity : null;
}

// Варіанти з властивостями: книга кожного рівня кожних чарів і всі зілля гри
function shopVariants(catalog) {
    const books = Object.entries(catalog.game.enchantments ?? {}).flatMap(([id, data]) => Array.from({ length: data.maxLevel }, (_, index) => ({
        id: `${id}_${index + 1}`, enchantment: id, level: index + 1, price: bookPrice(index + 1, !data.inTable),
    })));
    const ids = new Set(catalog.recipes.map(recipe => recipe.brewing?.outputPotion).filter(Boolean));
    const potions = [...ids].flatMap(potion => POTION_FORMS.map(([form, factor]) => ({
        id: `${form}:${potion}`, form, potion, price: Math.round(potionPrice(potion) * factor),
    })));
    return { books, potions };
}

class ShopService {
    variants(catalog) {
        return shopVariants(catalog);
    }

    // Будь-який предмет можна переробити на досвід, тому в грі немає непотрібних речей
    async recycle(user, stackId, requestedQuantity) {
        const quantity = validQuantity(requestedQuantity);
        if (!quantity) return fail(400, "Некоректна кількість");
        if (Object.values(user.tools ?? {}).some(id => id && String(id) === String(stackId))) return fail(400, "Цей предмет вдягнений");

        const { itemById } = await catalogService.get();
        const outcome = await Inventory.mutate(user._id, inventory => {
            const stack = inventory.items.id(String(stackId));
            const item = stack && itemById.get(stack.itemId.toString());
            if (!item) return { abort: true, status: 400, message: "Предмета вже немає в інвентарі" };
            if (!removeInventoryQuantity(inventory, item._id, quantity, stack.stackKey ?? "")) {
                return { abort: true, status: 400, message: "Недостатньо предметів" };
            }
            return { gained: recycleXp(item.marketPrice, quantity) };
        });
        if (outcome.abort) return fail(outcome.status, outcome.message);

        const updated = outcome.gained ? await User.addXp(user._id, outcome.gained) : await User.findById(user._id);
        return { success: true, status: 200, gainedXp: outcome.gained, experience: describeXp(updated), inventory: await Inventory.findByUserId(user._id) };
    }

    // Перекладає стільки, скільки вміщує цільовий стак. Решта лишається у вихідному
    async merge(user, fromId, toId) {
        const { itemById } = await catalogService.get();
        const outcome = await Inventory.mutate(user._id, inventory => {
            const from = fromId ? inventory.items.id(String(fromId)) : null;
            const to = toId ? inventory.items.id(String(toId)) : null;
            if (!from || !to || from === to) return { abort: true, status: 400, message: "Предмета вже немає в інвентарі" };
            if (from.itemId.toString() !== to.itemId.toString() || (from.stackKey ?? "") !== (to.stackKey ?? "")) {
                return { abort: true, status: 400, message: "Ці предмети не складаються" };
            }

            const room = maxStackSize(itemById.get(to.itemId.toString())) - to.quantity;
            if (room < 1) return { abort: true, status: 400, message: "Стак уже повний" };

            const moved = Math.min(room, from.quantity);
            to.quantity += moved;
            from.quantity -= moved;
            inventory.items = inventory.items.filter(stack => stack.quantity > 0);
        });
        if (outcome.abort) return fail(outcome.status, outcome.message);
        return { success: true, status: 200, inventory: await Inventory.findByUserId(user._id) };
    }

    // Зсипає однакові предмети в перші стаки. Властивості різні, тому зачаровані предмети не змішуються
    async compact(user) {
        const { itemById } = await catalogService.get();
        await Inventory.mutate(user._id, inventory => {
            const open = new Map();
            for (const stack of inventory.items) {
                const key = `${stack.itemId}|${stack.stackKey ?? ""}`;
                const target = open.get(key);
                const limit = maxStackSize(itemById.get(stack.itemId.toString()));
                if (target) {
                    const moved = Math.min(limit - target.quantity, stack.quantity);
                    target.quantity += moved;
                    stack.quantity -= moved;
                }
                if (stack.quantity > 0 && stack.quantity < limit) open.set(key, stack);
                else if (target?.quantity >= limit) open.delete(key);
            }
            // Однотипні предмети стають поруч: порядок масиву і є порядком у сітці
            const sortKey = stack => {
                const item = itemById.get(stack.itemId.toString());
                return `${item?.type ?? ""}|${item?.slug ?? ""}`;
            };
            inventory.items = inventory.items.filter(stack => stack.quantity > 0).sort((left, right) => sortKey(left).localeCompare(sortKey(right)));
        });
        return { success: true, status: 200, inventory: await Inventory.findByUserId(user._id) };
    }

    async buy(user, slug, requestedQuantity, variantId) {
        const quantity = validQuantity(requestedQuantity, MAX_PURCHASE);
        if (!quantity) return fail(400, "Некоректна кількість");

        const catalog = await catalogService.get();
        const { itemBySlug } = catalog;
        const item = itemBySlug.get(slug);
        if (!item?.buyable) return fail(404, "Цей предмет не продається");
        if (slug === KNOWLEDGE_BOOK && user.knowledge) return fail(400, "Книгу знань застосовано");

        let price = item.marketPrice;
        let components = POTION_ITEMS.has(slug) ? DEFAULT_POTION : undefined;
        if (variantId) {
            const { books, potions } = shopVariants(catalog);
            const book = slug === "enchanted_book" ? books.find(entry => entry.id === variantId) : null;
            const potion = potions.find(entry => entry.id === variantId && entry.form === slug) ?? null;
            if (!book && !potion) return fail(404, "Цей предмет не продається");
            price = (book ?? potion).price;
            components = book ? { stored_enchantments: { [book.enchantment]: book.level } } : { potion: potion.potion };
        }

        const cost = price * quantity;
        const updated = await User.spendCoins(user._id, cost);
        if (!updated) return fail(400, "Недостатньо монет");

        // Книга знань не лежить в інвентарі: вона застосовується одразу після покупки
        if (slug === KNOWLEDGE_BOOK) await User.setKnowledge(user._id);
        else await Inventory.addItems(user._id, [{ item, quantity, components }]);
        await questService.track(user, { bought: quantity });
        return { success: true, status: 200, balance: updated.balance, knowledge: slug === KNOWLEDGE_BOOK || undefined, inventory: await Inventory.findByUserId(user._id) };
    }

    async sell(user, stackId, requestedQuantity) {
        const quantity = validQuantity(requestedQuantity);
        if (!quantity) return fail(400, "Некоректна кількість");

        const { itemById } = await catalogService.get();
        const outcome = await Inventory.mutate(user._id, inventory => {
            const stack = inventory.items.id(String(stackId));
            const item = stack && itemById.get(stack.itemId.toString());
            if (!item) return { abort: true, status: 400, message: "Предмета вже немає в інвентарі" };
            if (!item.sellPrice) return { abort: true, status: 400, message: "Цей предмет не можна продати" };
            if (!removeInventoryQuantity(inventory, item._id, quantity, stack.stackKey ?? "")) {
                return { abort: true, status: 400, message: "Недостатньо предметів" };
            }
            return { coins: item.sellPrice * quantity };
        });
        if (outcome.abort) return fail(outcome.status, outcome.message);

        const updated = await User.incrementBalance(user._id, outcome.coins);
        await questService.track(user, { sold: quantity });
        const { loadout } = await loadoutService.forUser(user._id);
        return { success: true, status: 200, balance: updated.balance, inventory: await Inventory.findByUserId(user._id), loadout };
    }
}

export default new ShopService();
