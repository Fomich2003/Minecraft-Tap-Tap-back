import StationJob from "../models/StationJob.model.js";
import Inventory from "../repositories/Inventory.repository.js";
import User from "../repositories/User.repository.js";
import { baseDropChance } from "../data/drops.js";
import { levelFromXp } from "../data/experience.js";
import { clampScale, expeditionPlan, locationById, rollExpedition } from "../data/expeditions.js";
import { addInventoryQuantity, removeInventoryQuantity } from "../utils/inventory-stacks.js";
import { getRandomDropItems } from "../utils/random.js";
import cardService from "./card.service.js";
import jobService from "./job.service.js";
import questService from "./quest.service.js";

const fail = (status, message, params) => ({ success: false, status, message, params });
const FILLED_MAP = "filled_map";

// Похід зберігається тією ж роботою верстака, що й піч: одна на стіл, і вона йде без відкритого застосунку
function describe(job) {
    const elapsedMs = Date.now() - job.startedAt.getTime();
    return {
        station: job.station,
        location: job.output.components.location,
        scale: job.output.components.scale,
        locked: Boolean(job.input.components?.map_locked),
        mapId: job.input.components?.map_id ?? 0,
        durationMs: job.unitMs,
        elapsedMs,
        ready: elapsedMs >= job.unitMs,
    };
}

function planFor(map) {
    const location = map?.components?.map_location;
    return location ? expeditionPlan(location, map.components.map_scale) : null;
}

class ExpeditionService {
    async status(user, slug) {
        const { error } = await jobService.stationContext(user, slug, ["cartography"]);
        if (error) return error;
        const job = await StationJob.findOne({ userId: user._id, station: slug });
        return { success: true, status: 200, expedition: job ? describe(job) : null };
    }

    // Що обіцяє мапа: час, кількість знахідок і шанси. Гравець бачить це до старту
    async preview(user, slug, stackId) {
        const { error, catalog } = await jobService.stationContext(user, slug, ["cartography"]);
        if (error) return error;
        const inventory = await Inventory.findPlainByUserId(user._id);
        const stack = stackId ? inventory?.items.find(entry => String(entry._id) === String(stackId)) : null;
        const item = stack && catalog.itemById.get(stack.itemId.toString());
        if (item?.slug !== FILLED_MAP) return { success: true, status: 200, plan: null };
        const plan = planFor(stack);
        if (!plan) return { success: true, status: 200, plan: null };
        const location = locationById(plan.location);
        return {
            success: true, status: 200,
            plan: { ...plan, locked: Boolean(stack.components?.map_locked), open: levelFromXp(user.xpTotal) >= location.level, level: location.level },
        };
    }

    async start(user, slug, stackId) {
        const { error, catalog } = await jobService.stationContext(user, slug, ["cartography"]);
        if (error) return error;
        if (await StationJob.exists({ userId: user._id, station: slug })) return fail(409, "Розвідник ще в поході");

        let job = null;
        const outcome = await Inventory.mutate(user._id, inventory => {
            const stack = stackId ? inventory.items.id(String(stackId)) : null;
            const item = stack && catalog.itemById.get(stack.itemId.toString());
            if (item?.slug !== FILLED_MAP) return { abort: true, status: 400, message: "Поклади заповнену мапу" };
            const components = stack.components ?? {};
            const plan = planFor(stack);
            if (!plan) return { abort: true, status: 400, message: "На мапі немає локації" };
            const location = locationById(plan.location);
            if (levelFromXp(user.xpTotal) < location.level) return { abort: true, status: 403, message: "Потрібен рівень досвіду {level}", params: { level: location.level } };
            if (!removeInventoryQuantity(inventory, item._id, 1, stack.stackKey ?? "")) return { abort: true, status: 400, message: "Предмета вже немає в інвентарі" };

            job = {
                userId: user._id, station: slug, recipeKey: "expedition",
                input: { slug: FILLED_MAP, components },
                output: { slug: FILLED_MAP, quantity: 0, components: { location: plan.location, scale: clampScale(components.map_scale) } },
                units: 1, inputPerUnit: 1, unitMs: plan.ms, startedAt: new Date(),
            };
        });
        if (outcome.abort) return fail(outcome.status, outcome.message, outcome.params);

        try {
            const created = await StationJob.create(job);
            return { success: true, status: 200, expedition: describe(created), inventory: await Inventory.findByUserId(user._id) };
        } catch (failure) {
            if (failure.code !== 11000) throw failure;
            await Inventory.addItems(user._id, [{ item: catalog.itemBySlug.get(FILLED_MAP), quantity: 1, components: job.input.components }]);
            return fail(409, "Розвідник ще в поході");
        }
    }

    async collect(user, slug) {
        const { error, catalog } = await jobService.stationContext(user, slug, ["cartography"]);
        if (error) return error;
        const job = await StationJob.findOne({ userId: user._id, station: slug });
        if (!job) return fail(404, "Немає активної експедиції");
        if (!describe(job).ready) return fail(400, "Ще не готово");

        // Видалення в одному запиті з перевіркою: друга паралельна спроба нічого не знайде й нічого не отримає
        const claimed = await StationJob.findOneAndDelete({ _id: job._id, recipeKey: "expedition" });
        if (!claimed) return fail(409, "Результат уже забрано");

        const { itemBySlug, itemById } = catalog;
        const dropFor = (blockSlug, random) => {
            const block = itemBySlug.get(blockSlug);
            if (!block?.canDrop?.length || random() >= baseDropChance(blockSlug)) return null;
            const drop = getRandomDropItems(block.canDrop);
            return drop ? itemById.get(drop.itemId.toString())?.slug ?? null : null;
        };
        const plan = expeditionPlan(claimed.output.components.location, claimed.output.components.scale);
        const loot = rollExpedition(plan, { itemBySlug, dropFor });

        const entries = loot.items.map(({ slug: itemSlug, quantity }) => ({ item: itemBySlug.get(itemSlug), quantity }));
        // Скляна мапа не зношується: розвідник повертає її, і похід можна повторити
        const locked = Boolean(claimed.input.components?.map_locked);
        if (locked) entries.push({ item: itemBySlug.get(FILLED_MAP), quantity: 1, components: claimed.input.components });
        if (entries.length) {
            await Inventory.mutate(user._id, inventory => {
                for (const { item, quantity, components } of entries) addInventoryQuantity(inventory, item, quantity, components);
            });
        }
        if (loot.xp) await User.addXp(user._id, loot.xp);
        const card = loot.card ? await cardService.grant(user._id, loot.card) : null;
        await questService.track(user, { expeditions: 1 });

        return {
            success: true, status: 200, expedition: null,
            loot: { items: loot.items, treasure: loot.treasure, xp: loot.xp, mapReturned: locked, location: plan.location },
            card,
            inventory: await Inventory.findByUserId(user._id),
        };
    }

    // Відкликаний розвідник повертається з мапою, але без здобичі
    async recall(user, slug) {
        const { error, catalog } = await jobService.stationContext(user, slug, ["cartography"]);
        if (error) return error;
        const job = await StationJob.findOneAndDelete({ userId: user._id, station: slug, recipeKey: "expedition" });
        if (!job) return fail(404, "Немає активної експедиції");
        await Inventory.addItems(user._id, [{ item: catalog.itemBySlug.get(FILLED_MAP), quantity: 1, components: job.input.components }]);
        return { success: true, status: 200, expedition: null, inventory: await Inventory.findByUserId(user._id) };
    }
}

export default new ExpeditionService();
