import Inventory from "../repositories/Inventory.repository.js";
import User from "../repositories/User.repository.js";
import { removeInventoryQuantity } from "../utils/inventory-stacks.js";
import catalogService from "./catalog.service.js";

const fail = (status, message) => ({ success: false, status, message });

const DEFAULT_POTION = { potion: "water" };
const POTION_ITEMS = new Set(["potion", "splash_potion", "lingering_potion"]);

function validQuantity(value) {
    const quantity = Number(value);
    return Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 64 * 36 ? quantity : null;
}

class ShopService {
    async buy(user, slug, requestedQuantity) {
        const quantity = validQuantity(requestedQuantity);
        if (!quantity) return fail(400, "Некоректна кількість");

        const { itemBySlug } = await catalogService.get();
        const item = itemBySlug.get(slug);
        if (!item?.buyable) return fail(404, "Цей предмет не продається");

        const cost = item.marketPrice * quantity;
        const updated = await User.spendCoins(user._id, cost);
        if (!updated) return fail(400, "Недостатньо монет");

        await Inventory.addItems(user._id, [{ item, quantity, components: POTION_ITEMS.has(slug) ? DEFAULT_POTION : undefined }]);
        return { success: true, status: 200, balance: updated.balance, inventory: await Inventory.findByUserId(user._id) };
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
        return { success: true, status: 200, balance: updated.balance, inventory: await Inventory.findByUserId(user._id) };
    }
}

export default new ShopService();
