import crypto from "node:crypto";
import { ownedCount } from "../data/cards.js";
import { describeXp } from "../data/experience.js";
import { DAILY_QUESTS, DAILY_TIERS, PERMANENT_QUESTS, dailyCoins, questXp } from "../data/quests.js";
import Inventory from "../repositories/Inventory.repository.js";
import User from "../repositories/User.repository.js";
import catalogService from "./catalog.service.js";

const COOKING_STATIONS = ["furnace", "smoker", "blast_furnace", "campfire"];
const fail = (status, message) => ({ success: false, status, message });

const dailyById = new Map(DAILY_QUESTS.map(quest => [quest.id, quest]));
const permanentById = new Map(PERMANENT_QUESTS.map(quest => [quest.id, quest]));

// Доба квестів рахується за UTC: нові завдання з'являються для всіх одночасно
const currentDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

function nextReset(now = Date.now()) {
    const date = new Date(now);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}

// Гравець отримує документ зі звичайним Map, а lean-запит дає простий об'єкт
const readCounter = (counters, key) => (counters instanceof Map ? counters.get(key) : counters?.[key]) ?? 0;

// Ці цілі читаються зі стану гравця, тому зараховують і те, що зроблено до появи квестів
const STATE_METRICS = {
    level: { value: user => user.tapLevel ?? 0, filter: target => ({ tapLevel: { $gte: target } }) },
    blocks: { value: user => user.tapBlocks?.length ?? 0, filter: target => ({ [`tapBlocks.${target - 1}`]: { $exists: true } }) },
    stations: { value: user => user.stations?.length ?? 0, filter: target => ({ [`stations.${target - 1}`]: { $exists: true } }) },
    cards: { value: user => ownedCount(user), filter: target => ({ $expr: { $gte: [{ $size: { $objectToArray: { $ifNull: ["$cards", {}] } } }, target] } }) },
};

function canDo(quest, user) {
    if (quest.requires === "cooking") return COOKING_STATIONS.some(slug => user.stations?.includes(slug));
    if (quest.requires === "brewing") return Boolean(user.stations?.includes("brewing_stand"));
    return true;
}

// Набір залежить лише від дня й гравця, а зберігається, щоб покупка верстака вдень його не змінила
function rollDaily(user, day) {
    const hash = crypto.createHash("sha1").update(`${day}:${user._id}`).digest();
    const ids = DAILY_TIERS.map(tier => {
        const pool = DAILY_QUESTS.filter(quest => quest.tier === tier && canDo(quest, user));
        return pool[hash[tier] % pool.length].id;
    });
    return { day, ids, level: user.tapLevel ?? 0, progress: {}, claimed: [] };
}

const permanentProgress = (quest, user) => STATE_METRICS[quest.metric]?.value(user) ?? readCounter(user.questStats, quest.metric);

const isToday = user => user.daily?.day === currentDay();

function describe(quest, progress, claimed, coins) {
    return {
        id: quest.id, metric: quest.metric, target: quest.target, coins, xp: questXp(quest), items: quest.items,
        progress: Math.min(progress, quest.target), ready: progress >= quest.target && !claimed, claimed,
    };
}

function describeDaily(user) {
    if (!isToday(user)) return [];
    return user.daily.ids.map(id => {
        const quest = dailyById.get(id);
        return quest && describe(quest, readCounter(user.daily.progress, quest.metric), user.daily.claimed.includes(id), dailyCoins(quest, user.daily.level));
    }).filter(Boolean);
}

function describePermanent(user) {
    return PERMANENT_QUESTS.map(quest => describe(quest, permanentProgress(quest, user), Boolean(user.questsClaimed?.includes(quest.id)), quest.coins));
}

class QuestService {
    async ensureDaily(user) {
        if (isToday(user)) return user;
        await User.startDaily(user._id, currentDay(), rollDaily(user, currentDay()));
        return await User.findById(user._id);
    }

    // Лічильники не мають ламати саму дію гравця, тому збій лише логується
    async track(user, increments) {
        const entries = Object.entries(increments).filter(([, value]) => value > 0);
        if (!entries.length) return;
        try {
            if (!isToday(user)) await User.startDaily(user._id, currentDay(), rollDaily(user, currentDay()));
            await User.addQuestProgress(user._id, Object.fromEntries(entries));
        } catch (error) {
            console.error("[quests]", error.message);
        }
    }

    readyCount(user) {
        return [...describeDaily(user), ...describePermanent(user)].filter(quest => quest.ready).length;
    }

    async overview(user) {
        const fresh = await this.ensureDaily(user);
        const daily = describeDaily(fresh);
        const permanent = describePermanent(fresh);
        return {
            success: true, status: 200, daily, permanent, resetsAt: nextReset(),
            questsReady: [...daily, ...permanent].filter(quest => quest.ready).length,
        };
    }

    async claim(user, id) {
        const fresh = await this.ensureDaily(user);
        const isDaily = fresh.daily.ids.includes(id);
        const quest = isDaily ? dailyById.get(id) : permanentById.get(id);
        if (!quest) return fail(404, "Квест не знайдено");

        const coins = isDaily ? dailyCoins(quest, fresh.daily.level) : quest.coins;
        const progressFilter = isDaily || !STATE_METRICS[quest.metric]
            ? { [`${isDaily ? "daily.progress" : "questStats"}.${quest.metric}`]: { $gte: quest.target } }
            : STATE_METRICS[quest.metric].filter(quest.target);

        // Умови в самому запиті не дають забрати нагороду двічі паралельними запитами
        const updated = isDaily
            ? await User.claimDailyQuest(user._id, currentDay(), id, progressFilter, coins, questXp(quest))
            : await User.claimPermanentQuest(user._id, id, progressFilter, coins, questXp(quest));

        if (!updated) {
            const claimed = isDaily ? fresh.daily.claimed.includes(id) : fresh.questsClaimed?.includes(id);
            return fail(400, claimed ? "Нагороду вже забрано" : "Квест ще не виконано");
        }

        if (quest.items.length) {
            const { itemBySlug } = await catalogService.get();
            const entries = quest.items.map(({ slug, quantity }) => ({ item: itemBySlug.get(slug), quantity })).filter(entry => entry.item);
            await Inventory.addItems(user._id, entries);
        }

        const inventory = quest.items.length ? await Inventory.findByUserId(user._id) : undefined;
        return { ...(await this.overview(updated)), balance: updated.balance, inventory, experience: describeXp(updated), reward: { coins, xp: questXp(quest), items: quest.items } };
    }
}

export default new QuestService();
