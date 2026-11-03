// Експедиції столу картографа: заповнена мапа локації відправляє розвідника в похід за справжнім часом.
// Масштаб мапи (папір на столі) подовжує похід і пропорційно збільшує здобич, тож за годину вона однакова,
// а великі мапи зручні на ніч. Монет похід не дає: лише предмети локації, досвід, карти й скарб.
import { CARDS } from "./cards.js";
import { LOCATIONS } from "./locations.js";
import { MOBS } from "./mobs.js";
import { TAP_BLOCKS } from "./tap-blocks.js";

export const MAX_MAP_SCALE = 4;
// Тривалість походу при масштабі 0, хвилини. Глибші локації далі й небезпечніші
export const EXPEDITION_MINUTES = { surface: 20, caves: 40, depths: 60, nether: 90, end: 120 };
// Одна знахідка на стільки хвилин походу
const MINUTES_PER_FIND = 6;
const CARD_CHANCE_PER_SCALE = .1;
const TREASURE_CHANCE = .15;
const TREASURE_PER_SCALE = .15;

// Скарб під червоним хрестиком: [предмет, мінімум, максимум, вага]
export const TREASURES = {
    surface: [["emerald", 1, 2, 4], ["golden_apple", 1, 1, 2], ["name_tag", 1, 1, 2], ["saddle", 1, 1, 1]],
    caves: [["diamond", 1, 1, 2], ["iron_ingot", 3, 6, 4], ["name_tag", 1, 1, 2], ["golden_apple", 1, 1, 2]],
    depths: [["diamond", 1, 3, 3], ["echo_shard", 1, 2, 2], ["emerald", 2, 4, 3], ["disc_fragment_5", 1, 2, 1]],
    nether: [["gold_block", 1, 2, 3], ["ancient_debris", 1, 1, 2], ["netherite_scrap", 1, 1, 1], ["blaze_rod", 2, 4, 3]],
    end: [["ender_pearl", 2, 4, 4], ["shulker_shell", 1, 2, 3], ["dragon_breath", 1, 2, 2]],
};

export const locationById = id => LOCATIONS.find(entry => entry.id === id) ?? null;
export const locationIndex = id => LOCATIONS.findIndex(entry => entry.id === id);

const membersOf = id => ({
    blocks: TAP_BLOCKS.filter(block => CARDS.find(card => card.slug === block.slug)?.location === id).map(block => block.slug),
    mobs: MOBS.filter(mob => !mob.boss && CARDS.find(card => card.slug === mob.slug)?.location === id),
});
const MEMBERS = Object.fromEntries(LOCATIONS.map(location => [location.id, membersOf(location.id)]));

export const clampScale = scale => Math.min(MAX_MAP_SCALE, Math.max(0, Math.floor(Number(scale) || 0)));

export function expeditionPlan(locationId, scale) {
    const minutes = EXPEDITION_MINUTES[locationId];
    if (!minutes) return null;
    const size = clampScale(scale) + 1;
    // Знахідки рахуються від базового походу: кожен аркуш паперу додає рівно ще один такий самий
    const finds = Math.round(minutes / MINUTES_PER_FIND) * size;
    return {
        location: locationId,
        scale: size - 1,
        ms: minutes * size * 60000,
        finds,
        cardChance: Math.min(1, CARD_CHANCE_PER_SCALE * size),
        treasureChance: Math.min(1, TREASURE_CHANCE + TREASURE_PER_SCALE * (size - 1)),
        xp: finds * (locationIndex(locationId) + 1),
    };
}

const pick = (list, random) => list[Math.floor(random() * list.length) % list.length];
const between = (min, max, random) => min + Math.floor(random() * (max - min + 1));

function weighted(table, random) {
    const total = table.reduce((sum, entry) => sum + entry[3], 0);
    let roll = random() * total;
    for (const entry of table) {
        roll -= entry[3];
        if (roll < 0) return entry;
    }
    return table.at(-1);
}

// Здобич походу. Блоки дають те, що дав би їхній злам, моби свій дроп. canDrop береться з каталогу
export function rollExpedition(plan, { itemBySlug, dropFor }, random = Math.random) {
    const loot = new Map();
    const add = (slug, quantity) => {
        if (quantity > 0 && itemBySlug.has(slug)) loot.set(slug, (loot.get(slug) ?? 0) + quantity);
    };
    const { blocks, mobs } = MEMBERS[plan.location];
    const sources = [...blocks.map(slug => ({ kind: "block", slug })), ...mobs.map(mob => ({ kind: "mob", mob }))];
    for (let index = 0; index < plan.finds && sources.length; index += 1) {
        const source = pick(sources, random);
        if (source.kind === "block") {
            const drop = dropFor(source.slug, random);
            if (drop) add(drop, 1);
        } else {
            for (const [slug, min, max, chance] of source.mob.drops) if (random() < chance) add(slug, between(min, max, random));
        }
    }

    let treasure = null;
    if (random() < plan.treasureChance) {
        const [slug, min, max] = weighted(TREASURES[plan.location], random);
        if (itemBySlug.has(slug)) treasure = { slug, quantity: between(min, max, random) };
        if (treasure) add(treasure.slug, treasure.quantity);
    }

    const cards = [...blocks, ...mobs.map(mob => mob.slug)];
    const card = cards.length && random() < plan.cardChance ? pick(cards, random) : null;
    return { items: [...loot].map(([slug, quantity]) => ({ slug, quantity })), treasure, card, xp: plan.xp };
}
