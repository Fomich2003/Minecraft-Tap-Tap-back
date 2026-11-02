import { luckyDropChance } from "./effects.js";
import { levelFromXp } from "./experience.js";
import { LOCATIONS, locationOf } from "./locations.js";
import { MOBS } from "./mobs.js";
import { TAP_BLOCKS } from "./tap-blocks.js";
import { blockToolKind } from "./tools.js";

// Колекційні карти. Кожен блок і моб має свою карту, яка випадає лише з нього самого.
// Карти кладуться в колоду: карта підсилює своє джерело, масть дає загальний бонус, а поєднання карт у колоді
// дають комбо, як руки в покері. Дублікати підвищують рівень карти, а зайві після п'ятого рівня стають досвідом.

export const SUITS = ["mine", "nature", "monsters", "magic"];

// Шанс рахується на тап, а не на зламаний блок: так рідкісна руда, що ламається довго, не стає ще рідкіснішою
const RARITIES = {
    common: { perTap: 1 / 1500, power: 1, overflowXp: 3 },
    rare: { perTap: 1 / 3000, power: 1.25, overflowXp: 6 },
    epic: { perTap: 1 / 6000, power: 1.5, overflowXp: 15 },
    legendary: { perTap: 1 / 12000, power: 2, overflowXp: 40 },
};

const RARITY_BY_LOCATION = { surface: "common", caves: "rare", depths: "epic", nether: "epic", end: "legendary" };
const LEGENDARY = new Set(["ancient_debris", "wither", "ender_dragon"]);

const NATURE = new Set([
    "oak_leaves", "hay_block", "clay", "snow_block", "melon", "pumpkin", "cactus",
    "chicken", "cow", "pig", "sheep", "rabbit", "cod", "salmon",
]);
const MAGIC = new Set([
    "amethyst_block", "sculk", "obsidian", "glowstone", "nether_wart_block", "end_stone", "purpur_block", "chorus_flower",
    "witch", "enderman", "blaze", "shulker", "wither", "ender_dragon",
]);

function suitOf(slug, kind) {
    if (MAGIC.has(slug)) return "magic";
    if (NATURE.has(slug)) return "nature";
    if (kind === "mob") return "monsters";
    return blockToolKind(slug) === "pickaxe" ? "mine" : "nature";
}

function defineCard(slug, kind, name, icon) {
    const location = locationOf(slug).id;
    return { slug, kind, name, icon, location, suit: suitOf(slug, kind), rarity: LEGENDARY.has(slug) ? "legendary" : RARITY_BY_LOCATION[location] };
}

const locationRank = id => LOCATIONS.findIndex(entry => entry.id === id);

export const CARDS = [
    ...TAP_BLOCKS.map(block => defineCard(block.slug, "block", null, `/items/${block.slug}.png`)),
    ...MOBS.map(mob => defineCard(mob.slug, "mob", mob.name, mob.icon)),
].sort((left, right) => locationRank(left.location) - locationRank(right.location));

export const cardBySlug = new Map(CARDS.map(card => [card.slug, card]));

// Скільки копій потрібно для кожного рівня. Після останнього копія перетворюється на досвід
const LEVEL_COPIES = [1, 3, 6, 11, 20];
export const MAX_COPIES = LEVEL_COPIES.at(-1);

export const cardLevel = copies => LEVEL_COPIES.filter(needed => copies >= needed).length;
export const nextLevelCopies = copies => LEVEL_COPIES.find(needed => copies < needed) ?? null;
export const overflowXp = slug => RARITIES[cardBySlug.get(slug)?.rarity]?.overflowXp ?? 0;

// Колода росте разом зі спуском: кожна нова локація додає слот
const BASE_SLOTS = 3;
export const deckSlots = xpTotal => {
    const level = levelFromXp(xpTotal);
    return BASE_SLOTS + LOCATIONS.filter(location => location.level > 0 && level >= location.level).length;
};
export const MAX_DECK_SLOTS = BASE_SLOTS + LOCATIONS.filter(location => location.level > 0).length;

// Гравець приходить і документом Mongoose зі звичайним Map, і простим об'єктом з lean-запиту
export const ownedCopies = (user, slug) => (user.cards instanceof Map ? user.cards.get(slug) : user.cards?.[slug]) ?? 0;
export const ownedCount = user => (user.cards instanceof Map ? [...user.cards.values()] : Object.values(user.cards ?? {})).filter(copies => copies > 0).length;

// Резонанс: карта в колоді підсилює монети й дроп на своєму блоці чи мобі
const RESONANCE_PER_LEVEL = .08;
// Що дає масть: копальня і монстри дроп, природа монети, магія досвід
const SUIT_PER_LEVEL = { mine: .015, nature: .015, monsters: .02, magic: .03 };
// Зграя: три карти однієї масті, орда: п'ять. Множать бонус цієї масті
const PACKS = [{ id: "horde", size: 5, factor: 2 }, { id: "pack", size: 3, factor: 1.5 }];
const ELEMENTS_COINS = .1;
const BIOME_SIZE = 3;
const BIOME_DROP = .15;
const COLLECTION_COINS = .0025;

const strength = (card, copies) => cardLevel(copies) * RARITIES[card.rarity].power;

export const resonanceOf = (card, copies) => strength(card, copies) * RESONANCE_PER_LEVEL;
export const suitBonusOf = (card, copies) => strength(card, copies) * SUIT_PER_LEVEL[card.suit];

// Колода могла застаріти: слотів поменшало не буває, але чужі чи невідомі slug відкидаються
export function deckCards(user) {
    const slots = deckSlots(user.xpTotal);
    return (user.deck ?? [])
        .map(slug => cardBySlug.get(slug))
        .filter(card => card && ownedCopies(user, card.slug) > 0)
        .slice(0, slots);
}

// Повний розрахунок колоди. Результат у частках: 0.1 означає +10%
export function deckBonus(user) {
    const cards = deckCards(user);
    const suits = Object.fromEntries(SUITS.map(suit => [suit, 0]));
    const counts = Object.fromEntries(SUITS.map(suit => [suit, 0]));
    const resonance = {};
    const byLocation = {};
    const combos = [];

    for (const card of cards) {
        const copies = ownedCopies(user, card.slug);
        suits[card.suit] += suitBonusOf(card, copies);
        counts[card.suit] += 1;
        resonance[card.slug] = resonanceOf(card, copies);
        byLocation[card.location] = (byLocation[card.location] ?? 0) + 1;
    }

    for (const suit of SUITS) {
        const pack = PACKS.find(entry => counts[suit] >= entry.size);
        if (!pack) continue;
        suits[suit] *= pack.factor;
        combos.push({ id: pack.id, suit, factor: pack.factor });
    }

    const elements = SUITS.every(suit => counts[suit] > 0);
    if (elements) combos.push({ id: "elements", coins: ELEMENTS_COINS });

    const biome = {};
    for (const [location, count] of Object.entries(byLocation)) {
        if (count < BIOME_SIZE) continue;
        biome[location] = BIOME_DROP;
        combos.push({ id: "biome", location, drop: BIOME_DROP });
    }

    const collected = ownedCount(user);
    return {
        coins: suits.nature + (elements ? ELEMENTS_COINS : 0) + collected * COLLECTION_COINS,
        blockDrop: suits.mine,
        mobDrop: suits.monsters,
        xp: suits.magic,
        resonance, biome, combos, collected,
    };
}

export const cardCoinBonus = (bonus, slug) => bonus.coins + (bonus.resonance[slug] ?? 0);

export const cardDropBonus = (bonus, slug, kind) =>
    (kind === "mob" ? bonus.mobDrop : bonus.blockDrop) + (bonus.resonance[slug] ?? 0) + (bonus.biome[locationOf(slug).id] ?? 0);

// Дрібний досвід не губиться через округлення: залишок дає шанс на ще одне очко
export function cardXp(bonus, xp, random = Math.random()) {
    const value = xp * (1 + bonus.xp);
    return Math.floor(value) + (random < value % 1 ? 1 : 0);
}

// Не більше однієї карти на пачку тапів. Везіння підвищує шанс так само, як і для дропа
export function rollCard(slug, taps, effects, random = Math.random()) {
    const card = cardBySlug.get(slug);
    if (!card || taps < 1) return null;
    const chance = RARITIES[card.rarity].perTap * (1 + luckyDropChance(effects));
    return random < 1 - (1 - chance) ** taps ? card : null;
}

export const COLLECTION_BONUS_PER_CARD = COLLECTION_COINS;
