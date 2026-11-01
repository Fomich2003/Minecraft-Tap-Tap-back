import { dropChance, toolDropBonus, toPercent } from "../data/drops.js";
import { activeEffects, coinsWithEffects, consumableContainer, consumableEffects, isXpBottle, mergeEffects, powerFromEffects } from "../data/effects.js";
import { describeXp, XP_BOTTLE_POINTS } from "../data/experience.js";
import { locationOf } from "../data/locations.js";
import { mobDamage, swordDamage, swordDropBonus } from "../data/mobs.js";
import { blockToolKind, toolInfo, TOOL_KINDS } from "../data/tools.js";
import { coinsPerTap } from "../data/upgrades.js";
import Inventory from "../repositories/Inventory.repository.js";
import User from "../repositories/User.repository.js";
import { addInventoryQuantity, removeInventoryQuantity, stackKeyOf } from "../utils/inventory-stacks.js";
import catalogService from "./catalog.service.js";
import questService from "./quest.service.js";

const fail = (status, message) => ({ success: false, status, message });

function describeTool(stack, item) {
    const info = toolInfo(item.slug);
    if (!info) return null;
    const enchantments = stack.components?.enchantments ?? {};
    const isSword = info.kind === "sword";
    return {
        stackId: stack._id.toString(), slug: item.slug, name: item.name, icon: item.icon, kind: info.kind,
        power: isSword ? swordDamage(info.basePower, enchantments) : info.basePower + (enchantments.efficiency ?? 0),
        durability: item.maxDurability - (stack.components?.damage ?? 0),
        maxDurability: item.maxDurability,
        enchantments,
        dropBonus: isSword ? swordDropBonus(enchantments) : toolDropBonus(info.tier, enchantments),
    };
}

// Вдягнений інструмент міг зникнути з інвентаря: його продали, зламали або переробили на верстаку
export function equippedTool(user, inventory, kind, catalog) {
    const stackId = user.tools?.[kind];
    const stack = stackId && inventory?.items.id(stackId.toString());
    const item = stack && catalog.itemById.get(stack.itemId.toString());
    return item ? describeTool(stack, item) : null;
}

// Один удар не ламає більше блоків, ніж один тап
export function tapPower(slug, tapsToBreak, tool, effects) {
    const power = (tool?.power ?? 1) + powerFromEffects(slug, effects);
    return Math.min(Math.max(1, tapsToBreak ?? 1), power);
}

// Зношує інструмент разом із видачею дропа. Викликається всередині Inventory.mutate
export function wearTool(inventory, tool, amount) {
    const stack = inventory.items.id(tool.stackId);
    if (!stack) return false;
    const damage = Math.max(0, (stack.components?.damage ?? 0) + amount);
    if (damage >= tool.maxDurability) {
        inventory.items = inventory.items.filter(entry => entry._id.toString() !== tool.stackId);
        return true;
    }
    stack.components = { ...stack.components, damage };
    stack.stackKey = stackKeyOf(stack.components);
    return false;
}

class LoadoutService {
    // Клієнт нічого не рахує сам: сервер одразу повідомляє силу удару по кожному блоку гравця
    describe(user, inventory, catalog) {
        const effects = activeEffects(user);
        const tools = Object.fromEntries(TOOL_KINDS.map(kind => [kind, equippedTool(user, inventory, kind, catalog)]));
        const blocks = Object.fromEntries((user.tapBlocks ?? []).map(({ slug }) => {
            const kind = blockToolKind(slug);
            return [slug, { kind, power: tapPower(slug, catalog.itemBySlug.get(slug)?.tapsToBreak, tools[kind], effects), dropChance: toPercent(dropChance(slug, tools[kind], effects)), location: locationOf(slug).id }];
        }));
        return { tools, blocks, effects, experience: describeXp(user), damage: mobDamage(tools.sword, effects), coinsPerTap: coinsWithEffects(coinsPerTap(user.tapLevel ?? 0), effects) };
    }

    options(user, inventory, catalog) {
        const tools = [];
        const consumables = [];
        for (const stack of inventory?.items ?? []) {
            const item = catalog.itemById.get(stack.itemId.toString());
            if (!item) continue;
            const tool = describeTool(stack, item);
            if (tool) tools.push(tool);
            const effects = consumableEffects(item, stack.components);
            if (effects.length) {
                consumables.push({ stackId: stack._id.toString(), slug: item.slug, icon: item.icon, name: item.name, potion: stack.components?.potion, quantity: stack.quantity, effects });
            }
        }
        return { tools, consumables };
    }

    async forUser(userId) {
        const [user, inventory, catalog] = await Promise.all([User.findById(userId), Inventory.findPlainByUserId(userId), catalogService.get()]);
        return { user, inventory, catalog, loadout: this.describe(user, inventory, catalog) };
    }

    async overview(userId) {
        const { user, inventory, catalog, loadout } = await this.forUser(userId);
        return { success: true, status: 200, loadout, options: this.options(user, inventory, catalog) };
    }

    async equip(user, stackId, kind) {
        if (!stackId) {
            if (!TOOL_KINDS.includes(kind)) return fail(400, "Цим не можна копати");
            await User.setTool(user._id, kind, null);
            return await this.overview(user._id);
        }

        const [inventory, catalog] = await Promise.all([Inventory.findPlainByUserId(user._id), catalogService.get()]);
        const stack = inventory?.items.id(String(stackId));
        if (!stack) return fail(400, "Предмета вже немає в інвентарі");
        const info = toolInfo(catalog.itemById.get(stack.itemId.toString())?.slug);
        if (!info) return fail(400, "Цим не можна копати");

        await User.setTool(user._id, info.kind, stack._id);
        return await this.overview(user._id);
    }

    async consume(user, stackId) {
        const catalog = await catalogService.get();
        const outcome = await Inventory.mutate(user._id, inventory => {
            const stack = stackId ? inventory.items.id(String(stackId)) : null;
            const item = stack && catalog.itemById.get(stack.itemId.toString());
            if (!item) return { abort: true, status: 400, message: "Предмета вже немає в інвентарі" };

            const gained = consumableEffects(item, stack.components);
            const bottle = isXpBottle(item.slug);
            if (!gained.length && !bottle) return { abort: true, status: 400, message: "Цей предмет не можна використати" };
            // Досвід нічим не обмежений, тому стак пляшечок використовується відразу
            const used = bottle ? stack.quantity : 1;
            if (!removeInventoryQuantity(inventory, item._id, used, stack.stackKey ?? "")) {
                return { abort: true, status: 400, message: "Недостатньо предметів" };
            }

            const container = catalog.itemBySlug.get(consumableContainer(item.slug));
            if (container) addInventoryQuantity(inventory, container, 1);
            return { gained, used, xp: bottle ? XP_BOTTLE_POINTS * used : 0 };
        });
        if (outcome.abort) return fail(outcome.status, outcome.message);

        const fresh = await User.findById(user._id);
        await User.setEffects(user._id, mergeEffects(activeEffects(fresh), outcome.gained));
        if (outcome.xp) await User.addXp(user._id, outcome.xp);
        await questService.track(fresh, { consumed: outcome.used });
        return { ...(await this.overview(user._id)), inventory: await Inventory.findByUserId(user._id), gained: outcome.gained, gainedXp: outcome.xp };
    }
}

export default new LoadoutService();
