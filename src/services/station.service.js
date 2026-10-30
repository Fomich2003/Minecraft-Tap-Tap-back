import Inventory from "../repositories/Inventory.repository.js";
import User from "../repositories/User.repository.js";
import { addInventoryQuantity, removeInventoryQuantity } from "../utils/inventory-stacks.js";
import catalogService from "./catalog.service.js";
import { gridStation } from "./workstations/grid.js";
import { anvilStation, grindstoneStation } from "./workstations/anvil.js";
import { enchantingStation } from "./workstations/enchanting.js";
import { cartographyStation, loomStation, smithingStation, stonecutterStation } from "./workstations/simple-stations.js";

const HANDLERS = {
    grid: gridStation,
    stonecutter: stonecutterStation,
    smithing: smithingStation,
    anvil: anvilStation,
    grindstone: grindstoneStation,
    enchanting: enchantingStation,
    loom: loomStation,
    cartography: cartographyStation,
};

const fail = (status, message) => ({ success: false, status, message });

export function hasStation(user, station) {
    return station.isDefault || station.price === 0 || (user.stations ?? []).includes(station.slug);
}

// Клієнт надсилає лише id стаків: предмет і його властивості сервер бере з власного інвентаря
function resolveSlots(inventory, slotIds, handler, catalog) {
    const slots = {};
    for (const key of handler.slots()) {
        const stackId = slotIds?.[key];
        if (!stackId) continue;
        const stack = inventory.items.id(String(stackId));
        if (!stack) return null;
        const item = catalog.itemById.get(stack.itemId.toString());
        if (!item) return null;
        slots[key] = {
            slot: key,
            slug: item.slug,
            itemId: item._id,
            components: stack.components ?? undefined,
            stackKey: stack.stackKey ?? "",
            quantity: stack.quantity,
        };
    }
    return slots;
}

function requiredByStack(consume) {
    const required = new Map();
    for (const { cell, quantity } of consume) {
        const key = `${cell.itemId}|${cell.stackKey}`;
        if (!required.has(key)) required.set(key, { itemId: cell.itemId, stackKey: cell.stackKey, quantity: 0 });
        required.get(key).quantity += quantity;
    }
    return [...required.values()];
}

class StationService {
    async list(user) {
        const catalog = await catalogService.get();
        const stations = catalog.stations.map(station => {
            const owned = hasStation(user, station);
            return {
                slug: station.slug, name: station.name, uiType: station.uiType, price: station.price, needsFuel: station.needsFuel,
                icon: catalog.itemBySlug.get(station.itemSlug)?.icon ?? null,
                owned,
                active: user.activeStation === station.slug && owned,
            };
        });
        if (!stations.some(station => station.active)) stations.find(station => station.slug === "crafting_table").active = true;
        return { success: true, status: 200, stations };
    }

    async buy(user, slug) {
        const catalog = await catalogService.get();
        const station = catalog.stationBySlug.get(slug);
        if (!station) return fail(404, "Верстак не знайдено");
        if (hasStation(user, station)) return fail(400, "Верстак уже куплено");

        const updated = await User.purchaseStation(user._id, slug, station.price);
        if (!updated) return fail(400, "Недостатньо монет");
        return { ...(await this.list(updated)), balance: updated.balance };
    }

    async activate(user, slug) {
        const catalog = await catalogService.get();
        const station = catalog.stationBySlug.get(slug);
        if (!station) return fail(404, "Верстак не знайдено");
        if (!hasStation(user, station)) return fail(403, "Спочатку купи цей верстак");

        const updated = await User.setActiveStation(user._id, slug);
        return await this.list(updated);
    }

    async context(user, slug) {
        const catalog = await catalogService.get();
        const station = catalog.stationBySlug.get(slug);
        if (!station) return { error: fail(404, "Верстак не знайдено") };
        if (!hasStation(user, station)) return { error: fail(403, "Спочатку купи цей верстак") };
        const handler = HANDLERS[station.uiType];
        if (!handler) return { error: fail(400, "Цей верстак працює за часом") };
        return { catalog, station, handler };
    }

    async preview(user, slug, slotIds, options) {
        const { error, catalog, handler } = await this.context(user, slug);
        if (error) return error;

        const inventory = await Inventory.findPlainByUserId(user._id);
        if (!inventory) return fail(404, "Інвентар не знайдено");
        const slots = resolveSlots(inventory, slotIds, handler, catalog);
        if (!slots) return fail(400, "Предмета вже немає в інвентарі");

        const preview = handler.preview({ slots, catalog, user, options });
        return { success: true, status: 200, preview: preview ? { ...preview, consume: undefined } : null };
    }

    async apply(user, slug, slotIds, options) {
        const { error, catalog, handler } = await this.context(user, slug);
        if (error) return error;

        const plain = await Inventory.findPlainByUserId(user._id);
        const firstSlots = plain && resolveSlots(plain, slotIds, handler, catalog);
        if (!firstSlots) return fail(400, "Предмета вже немає в інвентарі");
        const quote = handler.preview({ slots: firstSlots, catalog, user, options });
        if (!quote?.result) return fail(400, quote?.message ?? "Рецепт не підходить");

        const coinCost = quote.coinCost ?? 0;
        if (coinCost && !(await User.spendCoins(user._id, coinCost))) return fail(400, "Недостатньо монет");

        const outcome = await Inventory.mutate(user._id, inventory => {
            const slots = resolveSlots(inventory, slotIds, handler, catalog);
            if (!slots) return { abort: true, status: 400, message: "Предмета вже немає в інвентарі" };
            const plan = handler.preview({ slots, catalog, user, options });
            if (!plan?.result) return { abort: true, status: 400, message: "Рецепт не підходить" };

            for (const { itemId, stackKey, quantity } of requiredByStack(plan.consume)) {
                if (!removeInventoryQuantity(inventory, itemId, quantity, stackKey)) {
                    return { abort: true, status: 400, message: "Недостатньо матеріалів в інвентарі" };
                }
            }

            const resultItem = catalog.itemBySlug.get(plan.result.slug);
            if (!resultItem) return { abort: true, status: 500, message: "Предмет результату не знайдено" };
            addInventoryQuantity(inventory, resultItem, plan.result.quantity ?? 1, plan.result.components);
            for (const slug of plan.remainders ?? []) addInventoryQuantity(inventory, catalog.itemBySlug.get(slug), 1);
            return { result: plan.result };
        });

        if (outcome.abort) {
            if (coinCost) await User.incrementBalance(user._id, coinCost);
            return fail(outcome.status, outcome.message);
        }
        if (handler.bumpsEnchantSeed) await User.bumpEnchantSeed(user._id);

        const [inventory, updatedUser] = await Promise.all([Inventory.findByUserId(user._id), User.findById(user._id)]);
        return { success: true, status: 200, result: outcome.result, inventory, balance: updatedUser.balance };
    }
}

export default new StationService();
