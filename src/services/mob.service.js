import { cardCoinBonus, cardDropBonus, cardXp, deckBonus, rollCard } from "../data/cards.js";
import { activeEffects, luckyDropChance } from "../data/effects.js";
import { levelFromXp } from "../data/experience.js";
import { locationOf } from "../data/locations.js";
import { mobBySlug, mobDamage, mobProgressKey, MOBS, swordDropBonus } from "../data/mobs.js";
import Inventory from "../repositories/Inventory.repository.js";
import User from "../repositories/User.repository.js";
import { addInventoryQuantity } from "../utils/inventory-stacks.js";
import blockService, { toolWear } from "./block.service.js";
import cardService from "./card.service.js";
import catalogService from "./catalog.service.js";
import loadoutService, { equippedTool, wearTool } from "./loadout.service.js";
import questService from "./quest.service.js";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const fail = (status, message, params) => ({ success: false, status, message, params });

const randomBetween = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

const hasMob = (user, mob) => mob.price === 0 || (user.mobs ?? []).includes(mob.slug);

const bossState = (user, slug) => user.bosses?.[slug] ?? {};

const bossActive = (user, slug, now = Date.now()) => {
    const state = bossState(user, slug);
    return Boolean(state.active && new Date(state.expiresAt).getTime() > now);
};

const readCounter = (counters, key) => (counters instanceof Map ? counters.get(key) : counters?.[key]) ?? 0;

function addDrops(drops, itemBySlug, slug, quantity) {
    const item = itemBySlug.get(slug);
    if (!item || quantity < 1) return false;
    const entry = drops.get(slug) ?? { item, quantity: 0 };
    entry.quantity += quantity;
    drops.set(slug, entry);
    return true;
}

// Бонуси множать шанс: рідкісний дроп лишається рідкісним навіть із найкращим мечем
function rollKills(mob, kills, sword, effects, itemBySlug, cardBonus) {
    const multiplier = 1 + swordDropBonus(sword?.enchantments) + luckyDropChance(effects) + cardBonus;
    const looting = sword?.enchantments.looting ?? 0;
    const drops = new Map();
    let missed = 0;

    for (let kill = 0; kill < kills; kill += 1) {
        let gained = false;
        for (const [slug, min, max, chance] of mob.drops) {
            if (Math.random() >= chance * multiplier) continue;
            if (addDrops(drops, itemBySlug, slug, randomBetween(min, max) + randomBetween(0, looting))) gained = true;
        }
        if (!gained) missed += 1;
    }
    return { drops: [...drops.values()], missed };
}

function rollBossLoot(mob, itemBySlug) {
    const drops = new Map();
    for (const [slug, min, max, chance] of mob.boss.loot) {
        if (Math.random() < chance) addDrops(drops, itemBySlug, slug, randomBetween(min, max));
    }
    return [...drops.values()];
}

function describeMob(mob, user, now) {
    const { slug, name, price, hp, icon, drops, boss } = mob;
    const base = {
        slug, name, price, hp, icon, owned: hasMob(user, mob), kills: readCounter(user.mobKills, slug), location: locationOf(slug),
        drops: (boss ? boss.loot : drops).map(([item, , , chance]) => ({ slug: item, chance: Math.round(chance * 100) })),
    };
    if (!boss) return base;
    const state = bossState(user, slug);
    return {
        ...base,
        boss: {
            minutes: boss.minutes, cooldownHours: boss.cooldownHours,
            coins: boss.coins * (1 + (user.tapLevel ?? 0)),
            active: bossActive(user, slug, now),
            expiresAt: state.expiresAt ?? null,
            readyAt: state.readyAt ?? null,
        },
    };
}

class MobService {
    list(user) {
        const now = Date.now();
        return { success: true, status: 200, mobs: MOBS.map(mob => describeMob(mob, user, now)) };
    }

    async buy(user, slug) {
        const mob = mobBySlug.get(slug);
        if (!mob || mob.boss) return fail(404, "Цього моба немає");
        if (hasMob(user, mob)) return fail(400, "Цей моб уже відкритий");
        const { level } = locationOf(slug);
        if (levelFromXp(user.xpTotal) < level) return fail(403, "Потрібен рівень досвіду {level}", { level });

        const updated = await User.purchaseMob(user._id, slug, mob.price);
        if (!updated) return fail(400, "Недостатньо монет");
        return { ...this.list(updated), balance: updated.balance };
    }

    // Умова на час у самому запиті: подвійне натискання не запустить бій двічі
    async summon(user, slug) {
        const mob = mobBySlug.get(slug);
        if (!mob?.boss) return fail(404, "Цього моба немає");
        const { level } = locationOf(slug);
        if (levelFromXp(user.xpTotal) < level) return fail(403, "Потрібен рівень досвіду {level}", { level });

        const now = Date.now();
        const updated = await User.summonBoss(user._id, slug, mobProgressKey(slug), {
            now: new Date(now),
            readyAt: new Date(now + mob.boss.cooldownHours * HOUR_MS),
            expiresAt: new Date(now + mob.boss.minutes * MINUTE_MS),
        });
        if (!updated) return fail(400, bossActive(user, slug, now) ? "Бос уже призваний" : "Бос ще відновлюється");
        return this.list(updated);
    }

    // Моби йдуть через той самий ліміт швидкості, що й блоки: окремого шляху до монет не існує
    async hit(userId, slug, count) {
        const requested = Number(count);
        if (!Number.isSafeInteger(requested) || requested < 1) return fail(400, "Некоректна кількість тапів");

        const user = await User.findById(userId);
        if (!user) return fail(404, "Користувача не знайдено");
        const mob = mobBySlug.get(slug);
        if (!mob) return fail(404, "Цього моба немає");
        if (mob.boss && !bossActive(user, slug)) return fail(400, "Бос утік");
        if (!mob.boss && !hasMob(user, mob)) return fail(403, "Спочатку відкрий цього моба");

        const catalog = await catalogService.get();
        const effects = activeEffects(user);
        const sword = equippedTool(user, await Inventory.findPlainByUserId(userId), "sword", catalog);
        const damage = Math.min(mob.hp, mobDamage(sword, effects));
        const cards = deckBonus(user);

        const applied = await blockService.spendTapTokens(userId, mobProgressKey(slug), requested, { tapsToBreak: mob.hp }, damage, effects, {
            keepProgress: Boolean(mob.boss), coinBonus: cardCoinBonus(cards, slug),
        });
        if (!applied) return fail(429, "Занадто швидко");

        // Бос гине один раз за призов, навіть якщо пачка ударів вийшла більшою за його здоров'я
        const won = mob.boss && applied.brokenBlocks > 0 ? await User.finishBoss(userId, slug) : null;
        const kills = mob.boss ? (won ? 1 : 0) : applied.brokenBlocks;
        const rolled = mob.boss ? { drops: won ? rollBossLoot(mob, catalog.itemBySlug) : [], missed: 0 } : rollKills(mob, kills, sword, effects, catalog.itemBySlug, cardDropBonus(cards, slug, "mob"));
        const { drops, missed } = rolled;

        const wear = sword ? toolWear(sword, kills, effects) : 0;
        let toolBroken = false;
        if (drops.length || wear) {
            await Inventory.mutate(userId, inventory => {
                for (const { item, quantity } of drops) addInventoryQuantity(inventory, item, quantity);
                toolBroken = wear ? wearTool(inventory, sword, wear) : false;
            });
        }

        const bonusCoins = won ? mob.boss.coins * (1 + (user.tapLevel ?? 0)) : 0;
        if (bonusCoins) await User.incrementBalance(userId, bonusCoins);
        if (kills) {
            await User.addMobKills(userId, slug, kills);
            await User.addXp(userId, cardXp(cards, kills * mob.xp));
        }
        // Карта боса гарантована перемогою, звичайні моби дають її з шансом на кожен удар
        const card = won || (!mob.boss && rollCard(slug, applied.taps, effects)) ? await cardService.grant(userId, slug) : null;

        const dropped = drops.reduce((sum, { quantity }) => sum + quantity, 0);
        await questService.track(user, { taps: applied.taps, coins: applied.coins, kills, drops: dropped, bosses: won ? 1 : 0 });

        const { user: updatedUser, loadout } = await loadoutService.forUser(userId);
        const inventory = drops.length || wear ? await Inventory.findByUserId(userId) : undefined;
        return {
            success: true, status: 200, user: updatedUser, inventory, loadout, acceptedTaps: applied.taps,
            drops: drops.map(({ item, quantity }) => ({ slug: item.slug, quantity })), missed,
            toolBroken: toolBroken ? sword.slug : null, message: `+${applied.coins}`, questsReady: questService.readyCount(updatedUser),
            bossDefeated: won ? { slug, coins: bonusCoins } : null, card,
        };
    }
}

export default new MobService();
