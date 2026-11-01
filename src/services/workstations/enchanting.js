import { ENCHANT_XP_PER_LEVEL } from "../../data/experience.js";

// Гравець ставить до 18 полиць, а сила столу, як в оригіналі, рахується до 15
export const MAX_BOOKSHELVES = 18;
const FULL_POWER_SHELVES = 15;

function createRandom(seed) {
    let state = seed >>> 0;
    const next = () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
        mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
    return { next, int: bound => Math.floor(next() * bound) };
}

function hashSlug(slug) {
    return [...slug].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) | 0, 7);
}

const levelCost = (cost, level) => cost.base + cost.per_level_above_first * (level - 1);

function weightedPick(random, entries) {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = random.int(total);
    for (const entry of entries) {
        roll -= entry.weight;
        if (roll < 0) return entry;
    }
    return entries[entries.length - 1];
}

function availableEnchantments(enchantments, slug, power) {
    const isBook = slug === "book";
    const found = [];
    for (const [id, data] of Object.entries(enchantments)) {
        if (!data.inTable || (!isBook && !data.primary.includes(slug))) continue;
        for (let level = data.maxLevel; level >= 1; level -= 1) {
            if (power >= levelCost(data.minCost, level) && power <= levelCost(data.maxCost, level)) {
                found.push({ id, level, weight: data.weight, exclusive: data.exclusive });
                break;
            }
        }
    }
    return found;
}

function selectEnchantments(random, enchantments, item, level) {
    const enchantability = item.enchantability;
    let power = level + 1 + random.int(Math.floor(enchantability / 4) + 1) + random.int(Math.floor(enchantability / 4) + 1);
    const bonus = 1 + (random.next() + random.next() - 1) * 0.15;
    power = Math.max(1, Math.round(power * bonus));

    let candidates = availableEnchantments(enchantments, item.slug, power);
    if (!candidates.length) return [];

    const picked = [weightedPick(random, candidates)];
    while (random.int(50) + 1 <= power) {
        const last = picked[picked.length - 1];
        candidates = candidates.filter(entry => entry.id !== last.id && !last.exclusive.includes(entry.id) && !entry.exclusive.includes(last.id));
        if (!candidates.length) break;
        picked.push(weightedPick(random, candidates));
        power = Math.floor(power / 2);
    }
    return picked;
}

// Як в оригіналі: кожна полиця піднімає рівень пропозицій, а без них стіл дає лише слабкі чари
function buildOffers(user, item, enchantments, shelves) {
    const baseRandom = createRandom((user.enchantSeed ?? 1) ^ hashSlug(item.slug));
    const base = baseRandom.int(8) + 1 + Math.floor(shelves / 2) + baseRandom.int(shelves + 1);
    const levels = [Math.max(Math.floor(base / 3), 1), Math.floor(base * 2 / 3) + 1, Math.max(base, shelves * 2)];

    return levels.map((level, index) => {
        const random = createRandom(((user.enchantSeed ?? 1) ^ hashSlug(item.slug)) + (index + 1) * 7919);
        let picked = selectEnchantments(random, enchantments, item, level);
        if (item.slug === "book" && picked.length > 1) picked.splice(random.int(picked.length), 1);
        return { level, lapis: index + 1, xpCost: level * ENCHANT_XP_PER_LEVEL, enchantments: picked.map(({ id, level: enchantLevel }) => ({ id, level: enchantLevel })) };
    });
}

export const enchantingStation = {
    slots: () => ["item", "lapis"],
    bumpsEnchantSeed: true,

    preview({ slots, catalog, user, options }) {
        const { item, lapis } = slots;
        if (!item) return null;
        const shelves = Math.round((user.bookshelves ?? 0) * FULL_POWER_SHELVES / MAX_BOOKSHELVES);
        const data = catalog.itemBySlug.get(item.slug);
        if (!data?.enchantability || item.components?.enchantments) return { choices: [] };

        const choices = buildOffers(user, data, catalog.game.enchantments, shelves)
            .map((offer, index) => ({ index, ...offer, name: offer.enchantments[0] ? catalog.game.enchantments[offer.enchantments[0].id].name : null }))
            .filter(offer => offer.enchantments.length);
        const offer = choices.find(entry => entry.index === options?.offer);
        if (!offer) return { choices };
        if (lapis?.slug !== "lapis_lazuli" || lapis.quantity < offer.lapis) return { choices, message: "Потрібен лазурит" };

        const enchantments = Object.fromEntries(offer.enchantments.map(entry => [entry.id, entry.level]));
        const isBook = item.slug === "book";
        return {
            choices,
            xpCost: offer.xpCost,
            result: {
                slug: isBook ? "enchanted_book" : item.slug,
                quantity: 1,
                components: isBook ? { stored_enchantments: enchantments } : { ...item.components, enchantments },
            },
            consume: [{ cell: item, quantity: 1 }, { cell: lapis, quantity: offer.lapis }],
        };
    },
};
