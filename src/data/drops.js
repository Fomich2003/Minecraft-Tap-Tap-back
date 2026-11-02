import { luckyDropChance } from "./effects.js";
import { blockToolKind } from "./tools.js";

// Шанс, що зламаний блок щось дасть. Каталог і canDrop не змінюються: вони вирішують що випаде, а це чи випаде взагалі.
const BASE_CHANCE = {
    oak_log: .7, birch_log: .7, spruce_log: .7, jungle_log: .7, acacia_log: .7, dark_oak_log: .7,
    mangrove_log: .7, cherry_log: .7, pale_oak_log: .7, poplar_log: .7,
    dirt: .75, sand: .75, gravel: .7, netherrack: .7, stone: .65,
    crimson_stem: .6, warped_stem: .6, coal_ore: .6, copper_ore: .55, iron_ore: .5, end_stone: .5,
    gold_ore: .45, redstone_ore: .45, nether_quartz_ore: .45, lapis_ore: .4, obsidian: .4,
    emerald_ore: .2, diamond_ore: .15, ancient_debris: .15,
    oak_leaves: .7, hay_block: .75, clay: .7, snow_block: .75, melon: .7, pumpkin: .7, cactus: .7,
    tuff: .65, calcite: .6, dripstone_block: .55, amethyst_block: .4, deepslate: .6, sculk: .4,
    nether_gold_ore: .5, soul_sand: .7, basalt: .65, blackstone: .6, magma_block: .55, nether_wart_block: .55, glowstone: .45,
    purpur_block: .45, chorus_flower: .4,
};
const DEFAULT_CHANCE = .6;

// Камінь і руди голими руками майже не видобуваються, як в оригіналі
const BARE_HANDS_FACTOR = .5;
const TIER_BONUS = { wooden: .05, golden: .08, stone: .1, copper: .12, iron: .15, diamond: .2, netherite: .3 };
const FORTUNE_PER_LEVEL = .1;
const SILK_TOUCH_BONUS = .2;

export function toolDropBonus(tier, enchantments = {}) {
    const fortune = (enchantments.fortune ?? 0) * FORTUNE_PER_LEVEL;
    return (TIER_BONUS[tier] ?? 0) + fortune + (enchantments.silk_touch ? SILK_TOUCH_BONUS : 0);
}

// Бонуси множать базовий шанс: додані до нього, вони робили алмазну руду майже такою ж щедрою, як земля
export function dropChance(slug, tool, effects, cardBonus = 0) {
    const base = BASE_CHANCE[slug] ?? DEFAULT_CHANCE;
    const hands = !tool && blockToolKind(slug) === "pickaxe" ? BARE_HANDS_FACTOR : 1;
    return base * hands * (1 + (tool?.dropBonus ?? 0) + luckyDropChance(effects) + cardBonus);
}

export const baseDropChance = slug => BASE_CHANCE[slug] ?? DEFAULT_CHANCE;

export const toPercent = chance => Math.round(chance * 100);

// Шанс понад 100% не згорає: ціла частина гарантована, а залишок дає шанс на ще один предмет
export function dropsPerBlock(chance, random = Math.random()) {
    return Math.floor(chance) + (random < chance % 1 ? 1 : 0);
}
