import StationJob from "../models/StationJob.model.js";
import Inventory from "../repositories/Inventory.repository.js";
import User from "../repositories/User.repository.js";
import { addInventoryQuantity, removeInventoryQuantity } from "../utils/inventory-stacks.js";
import catalogService from "./catalog.service.js";
import questService from "./quest.service.js";
import { hasStation } from "./station.service.js";

const TICK_MS = 50;
const CAMPFIRE_CAPACITY = 4;
const BREW_MS = 400 * TICK_MS;
const BLAZE_POWDER_FUEL = 20;
const MAX_BOTTLES = 3;
const EMPTY_BOTTLE = "glass_bottle";
const WATER = { potion: "water" };
const FUEL_REMAINDERS = { lava_bucket: "bucket" };

const fail = (status, message, params) => ({ success: false, status, message, params });

function stackAt(inventory, stackId, catalog) {
    const stack = stackId ? inventory.items.id(String(stackId)) : null;
    if (!stack) return null;
    const item = catalog.itemById.get(stack.itemId.toString());
    return item ? { stack, item, stackKey: stack.stackKey ?? "", components: stack.components ?? undefined } : null;
}

function describe(job) {
    const elapsedUnits = Math.floor((Date.now() - job.startedAt.getTime()) / job.unitMs);
    const finished = Math.min(job.units, elapsedUnits);
    return {
        station: job.station,
        units: job.units,
        finished,
        collected: job.collectedUnits,
        ready: finished - job.collectedUnits,
        unitMs: job.unitMs,
        elapsedMs: Date.now() - job.startedAt.getTime(),
        input: job.input,
        output: job.output,
    };
}

class JobService {
    async stationContext(user, slug, uiTypes) {
        const catalog = await catalogService.get();
        const station = catalog.stationBySlug.get(slug);
        if (!station) return { error: fail(404, "Верстак не знайдено") };
        if (!hasStation(user, station)) return { error: fail(403, "Спочатку купи цей верстак") };
        if (!uiTypes.includes(station.uiType)) return { error: fail(400, "Цей верстак працює миттєво") };
        return { catalog, station };
    }

    async status(user, slug) {
        const { error } = await this.stationContext(user, slug, ["cooking", "brewing"]);
        if (error) return error;
        const job = await StationJob.findOne({ userId: user._id, station: slug });
        return { success: true, status: 200, job: job ? describe(job) : null, brewingFuel: user.brewingFuel ?? 0 };
    }

    async previewCooking(user, slug, slotIds) {
        const { error, catalog, station } = await this.stationContext(user, slug, ["cooking"]);
        if (error) return error;
        const inventory = await Inventory.findPlainByUserId(user._id);
        const input = inventory && stackAt(inventory, slotIds?.input, catalog);
        if (!input) return { success: true, status: 200, preview: null };
        const recipe = (catalog.recipesByStation.get(slug) ?? []).find(candidate => candidate.input.includes(input.item.slug));
        if (!recipe) return { success: true, status: 200, preview: null };
        const fuel = stackAt(inventory, slotIds?.fuel, catalog);
        return {
            success: true, status: 200,
            preview: {
                result: recipe.result, unitMs: recipe.cookTime * TICK_MS,
                burnTicks: fuel ? catalog.game.fuels[fuel.item.slug] ?? 0 : 0,
                cookTicks: recipe.cookTime, needsFuel: station.needsFuel,
            },
        };
    }

    async startCooking(user, slug, slotIds, requestedQuantity) {
        const { error, catalog, station } = await this.stationContext(user, slug, ["cooking"]);
        if (error) return error;
        if (await StationJob.exists({ userId: user._id, station: slug })) return fail(409, "Верстак ще працює");

        const wanted = Number(requestedQuantity);
        if (!Number.isSafeInteger(wanted) || wanted < 1) return fail(400, "Некоректна кількість");
        const capacity = slug === "campfire" ? CAMPFIRE_CAPACITY : 64;
        if (wanted > capacity) return fail(400, "Можна завантажити максимум {count}", { count: capacity });

        let job = null;
        const outcome = await Inventory.mutate(user._id, inventory => {
            const input = stackAt(inventory, slotIds?.input, catalog);
            if (!input) return { abort: true, status: 400, message: "Предмета вже немає в інвентарі" };
            const recipe = (catalog.recipesByStation.get(slug) ?? []).find(candidate => candidate.input.includes(input.item.slug));
            if (!recipe) return { abort: true, status: 400, message: "Цей предмет не можна тут обробити" };

            if (!removeInventoryQuantity(inventory, input.item._id, wanted, input.stackKey)) {
                return { abort: true, status: 400, message: "Недостатньо предметів" };
            }

            if (station.needsFuel) {
                const fuel = stackAt(inventory, slotIds?.fuel, catalog);
                const burnTicks = fuel ? catalog.game.fuels[fuel.item.slug] : 0;
                if (!burnTicks) return { abort: true, status: 400, message: "Потрібне паливо" };
                const fuelUnits = Math.ceil(recipe.cookTime * wanted / burnTicks);
                if (!removeInventoryQuantity(inventory, fuel.item._id, fuelUnits, fuel.stackKey)) {
                    return { abort: true, status: 400, message: "Недостатньо палива" };
                }
                const remainder = FUEL_REMAINDERS[fuel.item.slug];
                if (remainder) addInventoryQuantity(inventory, catalog.itemBySlug.get(remainder), fuelUnits);
            }

            job = {
                userId: user._id, station: slug, recipeKey: recipe.recipeKey,
                input: { slug: input.item.slug, components: input.components },
                output: { slug: recipe.result.slug, quantity: recipe.result.quantity ?? 1, components: recipe.result.components },
                units: wanted, inputPerUnit: 1, unitMs: recipe.cookTime * TICK_MS, startedAt: new Date(),
            };
        });
        if (outcome.abort) return fail(outcome.status, outcome.message);
        return await this.saveJob(user, job, catalog);
    }

    async startBrewing(user, slug, slotIds) {
        const { error, catalog } = await this.stationContext(user, slug, ["brewing"]);
        if (error) return error;
        if (await StationJob.exists({ userId: user._id, station: slug })) return fail(409, "Варіння ще триває");

        let job = null;
        const outcome = await Inventory.mutate(user._id, async inventory => {
            const fresh = await User.findById(user._id);
            const reagent = stackAt(inventory, slotIds?.reagent, catalog);
            const bottle = stackAt(inventory, slotIds?.bottle, catalog);
            if (!reagent || !bottle) return { abort: true, status: 400, message: "Поклади пляшечки й інгредієнт" };

            const count = Math.min(MAX_BOTTLES, Math.max(1, Number(slotIds?.bottleCount) || 1));
            const potion = bottle.components?.potion;
            const recipe = (catalog.recipesByStation.get(slug) ?? []).find(candidate =>
                candidate.brewing.item === bottle.item.slug && candidate.brewing.potion === potion && candidate.brewing.reagent === reagent.item.slug);
            if (!recipe) return { abort: true, status: 400, message: "Такого зілля не існує" };

            const fuel = fresh.brewingFuel ?? 0;
            let refill = 0;
            if (fuel < 1) {
                const powder = stackAt(inventory, slotIds?.fuel, catalog);
                if (powder?.item.slug !== "blaze_powder" || !removeInventoryQuantity(inventory, powder.item._id, 1, powder.stackKey)) {
                    return { abort: true, status: 400, message: "Потрібен порох іфрита" };
                }
                refill = BLAZE_POWDER_FUEL;
            }
            if (!removeInventoryQuantity(inventory, bottle.item._id, count, bottle.stackKey)
                || !removeInventoryQuantity(inventory, reagent.item._id, 1, reagent.stackKey)) {
                return { abort: true, status: 400, message: "Недостатньо предметів" };
            }

            job = {
                userId: user._id, station: slug, recipeKey: recipe.recipeKey,
                input: { slug: bottle.item.slug, components: bottle.components },
                output: { slug: recipe.brewing.outputItem, quantity: count, components: { potion: recipe.brewing.outputPotion } },
                units: 1, inputPerUnit: count, unitMs: BREW_MS, startedAt: new Date(),
            };
            return { fuelChange: refill - 1 };
        });
        if (outcome.abort) return fail(outcome.status, outcome.message);
        await User.changeBrewingFuel(user._id, outcome.fuelChange);
        return await this.saveJob(user, job, catalog);
    }

    // Вода безплатна, як у грі. Стійка вміщує три пляшечки, тому й наповнюється три за раз
    async fillBottles(user, slug, slotIds, requestedCount) {
        const { error, catalog } = await this.stationContext(user, slug, ["brewing"]);
        if (error) return error;
        const count = Number(requestedCount);
        if (!Number.isSafeInteger(count) || count < 1 || count > MAX_BOTTLES) return fail(400, "Некоректна кількість");

        const outcome = await Inventory.mutate(user._id, inventory => {
            const bottle = stackAt(inventory, slotIds?.bottle, catalog);
            if (bottle?.item.slug !== EMPTY_BOTTLE) return { abort: true, status: 400, message: "Поклади порожні пляшечки" };
            if (!removeInventoryQuantity(inventory, bottle.item._id, count, bottle.stackKey)) {
                return { abort: true, status: 400, message: "Недостатньо предметів" };
            }
            addInventoryQuantity(inventory, catalog.itemBySlug.get("potion"), count, WATER);
        });
        if (outcome.abort) return fail(outcome.status, outcome.message);
        return { success: true, status: 200, inventory: await Inventory.findByUserId(user._id) };
    }

    async saveJob(user, job, catalog) {
        try {
            const created = await StationJob.create(job);
            const inventory = await Inventory.findByUserId(user._id);
            return { success: true, status: 200, job: describe(created), inventory };
        } catch (error) {
            if (error.code !== 11000) throw error;
            const inputItem = catalog.itemBySlug.get(job.input.slug);
            await Inventory.addItems(user._id, [{ item: inputItem, quantity: job.units * job.inputPerUnit, components: job.input.components }]);
            return fail(409, "Верстак ще працює");
        }
    }

    async collect(user, slug) {
        const { error, catalog, station } = await this.stationContext(user, slug, ["cooking", "brewing"]);
        if (error) return error;
        const job = await StationJob.findOne({ userId: user._id, station: slug });
        if (!job) return fail(404, "Немає завершеної роботи");

        const state = describe(job);
        if (!state.ready) return fail(400, "Ще не готово");

        // Лічильник у фільтрі не дає забрати той самий результат двома запитами
        const claimed = await StationJob.findOneAndUpdate(
            { _id: job._id, collectedUnits: job.collectedUnits },
            { $set: { collectedUnits: state.finished } },
            { returnDocument: "after" },
        );
        if (!claimed) return fail(409, "Результат уже забрано");

        const item = catalog.itemBySlug.get(job.output.slug);
        await Inventory.addItems(user._id, [{ item, quantity: state.ready * job.output.quantity, components: job.output.components }]);
        if (state.finished >= job.units) await StationJob.deleteOne({ _id: job._id });
        await questService.track(user, { [station.uiType === "brewing" ? "brewed" : "cooked"]: state.ready * job.output.quantity });

        const inventory = await Inventory.findByUserId(user._id);
        const remaining = state.finished >= job.units ? null : describe(claimed);
        return { success: true, status: 200, job: remaining, inventory };
    }

    async cancel(user, slug) {
        const { error, catalog } = await this.stationContext(user, slug, ["cooking", "brewing"]);
        if (error) return error;
        const job = await StationJob.findOneAndDelete({ userId: user._id, station: slug });
        if (!job) return fail(404, "Немає активної роботи");

        const state = describe(job);
        const entries = [];
        if (state.ready) entries.push({ item: catalog.itemBySlug.get(job.output.slug), quantity: state.ready * job.output.quantity, components: job.output.components });
        const unfinished = job.units - state.finished;
        if (unfinished) entries.push({ item: catalog.itemBySlug.get(job.input.slug), quantity: unfinished * job.inputPerUnit, components: job.input.components });
        if (entries.length) await Inventory.addItems(user._id, entries);

        return { success: true, status: 200, job: null, inventory: await Inventory.findByUserId(user._id) };
    }
}

export default new JobService();
