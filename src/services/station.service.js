import Inventory from "../repositories/Inventory.repository.js";
import User from "../repositories/User.repository.js";
import { addInventoryQuantity, countInventoryQuantity, removeInventoryQuantity } from "../utils/inventory-stacks.js";
import catalogService from "./catalog.service.js";
import loadoutService from "./loadout.service.js";
import questService from "./quest.service.js";
import { gridStation } from "./workstations/grid.js";
import { anvilStation, grindstoneStation } from "./workstations/anvil.js";
import { enchantingStation, MAX_BOOKSHELVES } from "./workstations/enchanting.js";
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

const MAX_CRAFT_TIMES = 64;

const fail = (status, message) => ({ success: false, status, message });

// Скільки предметів один крафт забирає з кожного слота. Клієнт віднімає це від вмісту слотів
function usesBySlot(consume) {
    const uses = {};
    for (const { cell, quantity } of consume ?? []) uses[cell.slot] = (uses[cell.slot] ?? 0) + quantity;
    return uses;
}

function craftTimes(handler, requested) {
    if (requested === undefined || requested === null) return 1;
    const times = Number(requested);
    if (!Number.isSafeInteger(times) || times < 1 || times > MAX_CRAFT_TIMES) return null;
    return handler.repeatable || times === 1 ? times : null;
}

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

const RECIPE_STATIONS = new Set(["crafting_table", "stonecutter", "furnace", "blast_furnace", "smoker", "campfire"]);

// Клітинки рецепта одним форматом: сітка 3×3 для верстака, список для решти станцій
function recipeCells(recipe) {
    if (recipe.kind === "shaped") return { width: recipe.width, cells: recipe.pattern };
    if (recipe.kind === "shapeless") return { width: 3, cells: recipe.ingredients };
    return recipe.input?.length ? { width: 1, cells: [recipe.input] } : null;
}

class StationService {
    // Полиці ставляться один раз: вони зникають з інвентаря й лишаються біля столу назавжди
    async installBookshelves(user) {
        const room = MAX_BOOKSHELVES - (user.bookshelves ?? 0);
        if (room < 1) return fail(400, "Усі полиці вже стоять");

        const { itemBySlug } = await catalogService.get();
        const shelf = itemBySlug.get("bookshelf");
        const outcome = await Inventory.mutate(user._id, inventory => {
            const count = Math.min(room, countInventoryQuantity(inventory, shelf._id));
            if (count < 1) return { abort: true, status: 400, message: "Немає полиць в інвентарі" };
            removeInventoryQuantity(inventory, shelf._id, count);
            return { count };
        });
        if (outcome.abort) return fail(outcome.status, outcome.message);

        const updated = await User.addBookshelves(user._id, outcome.count, MAX_BOOKSHELVES);
        if (!updated) {
            await Inventory.addItems(user._id, [{ item: shelf, quantity: outcome.count }]);
            return fail(400, "Усі полиці вже стоять");
        }
        return { success: true, status: 200, bookshelves: updated.bookshelves, inventory: await Inventory.findByUserId(user._id) };
    }

    async recipes(user) {
        if (!user.knowledge) return fail(403, "Потрібна книга знань");
        const { recipes, recipesByStation } = await catalogService.get();
        const list = recipes.filter(recipe => RECIPE_STATIONS.has(recipe.station) && recipe.result?.slug).flatMap(recipe => {
            const layout = recipeCells(recipe);
            return layout ? [{ key: recipe.recipeKey, station: recipe.station, ...layout, result: recipe.result }] : [];
        });
        const potions = (recipesByStation.get("brewing_stand") ?? []).map(({ recipeKey, station, brewing }) => ({
            key: recipeKey, station,
            brewing: { bottle: brewing.item, potion: brewing.potion, reagent: brewing.reagent },
            result: { slug: brewing.outputItem, quantity: 1, components: { potion: brewing.outputPotion } },
        }));
        return { success: true, status: 200, recipes: [...list, ...potions] };
    }

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
        return {
            success: true, status: 200,
            preview: preview ? { ...preview, consume: undefined, uses: usesBySlot(preview.consume), repeatable: Boolean(handler.repeatable) } : null,
        };
    }

    async apply(user, slug, slotIds, options, requestedTimes) {
        const { error, catalog, handler } = await this.context(user, slug);
        if (error) return error;

        const times = craftTimes(handler, requestedTimes);
        if (!times) return fail(400, "Некоректна кількість");

        const plain = await Inventory.findPlainByUserId(user._id);
        const firstSlots = plain && resolveSlots(plain, slotIds, handler, catalog);
        if (!firstSlots) return fail(400, "Предмета вже немає в інвентарі");
        const quote = handler.preview({ slots: firstSlots, catalog, user, options });
        if (!quote?.result) return fail(400, quote?.message ?? "Рецепт не підходить");

        const xpCost = (quote.xpCost ?? 0) * times;
        if (xpCost && !(await User.spendXp(user._id, xpCost))) return fail(400, "Недостатньо досвіду");

        const outcome = await Inventory.mutate(user._id, inventory => {
            const slots = resolveSlots(inventory, slotIds, handler, catalog);
            if (!slots) return { abort: true, status: 400, message: "Предмета вже немає в інвентарі" };
            const plan = handler.preview({ slots, catalog, user, options });
            if (!plan?.result) return { abort: true, status: 400, message: "Рецепт не підходить" };

            for (const { itemId, stackKey, quantity } of requiredByStack(plan.consume)) {
                if (!removeInventoryQuantity(inventory, itemId, quantity * times, stackKey)) {
                    return { abort: true, status: 400, message: "Недостатньо матеріалів в інвентарі" };
                }
            }

            const resultItem = catalog.itemBySlug.get(plan.result.slug);
            if (!resultItem) return { abort: true, status: 500, message: "Предмет результату не знайдено" };
            addInventoryQuantity(inventory, resultItem, (plan.result.quantity ?? 1) * times, plan.result.components);
            for (const slug of plan.remainders ?? []) addInventoryQuantity(inventory, catalog.itemBySlug.get(slug), times);

            const used = Object.fromEntries(Object.entries(usesBySlot(plan.consume)).map(([slot, quantity]) => [slot, quantity * times]));
            return { result: plan.result, used };
        });

        if (outcome.abort) {
            if (xpCost) await User.refundXp(user._id, xpCost);
            return fail(outcome.status, outcome.message);
        }
        if (handler.bumpsEnchantSeed) await User.bumpEnchantSeed(user._id);
        await questService.track(user, { crafts: (outcome.result.quantity ?? 1) * times });

        const [inventory, updatedUser, { loadout }] = await Promise.all([Inventory.findByUserId(user._id), User.findById(user._id), loadoutService.forUser(user._id)]);
        return { success: true, status: 200, result: outcome.result, used: outcome.used, times, inventory, balance: updatedUser.balance, loadout };
    }
}

export default new StationService();
