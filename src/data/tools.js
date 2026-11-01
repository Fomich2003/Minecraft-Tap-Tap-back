// Інструменти в тапанні. Сила показує, скільки тапів зараховує один удар підхожим інструментом.
// Порядок ярусів ванільний: золото найшвидше, але ламається першим.
const TIER_POWER = { wooden: 2, stone: 2, copper: 3, iron: 3, diamond: 4, netherite: 5, golden: 6 };
// Шкода меча по мобах: ванільні значення
const SWORD_DAMAGE = { wooden: 4, golden: 4, stone: 5, copper: 5, iron: 6, diamond: 7, netherite: 8 };

const TOOL_PATTERN = /^(wooden|stone|copper|iron|golden|diamond|netherite)_(pickaxe|axe|shovel|sword)$/;
const SHOVEL_BLOCKS = new Set(["dirt", "sand", "gravel"]);
const NETHER_BLOCKS = new Set(["netherrack", "crimson_stem", "warped_stem", "nether_quartz_ore", "ancient_debris"]);

// Інша зброя займає слот меча
const OTHER_WEAPONS = {
    trident: 9, mace: 8, wooden_spear: 3, stone_spear: 4, copper_spear: 4, golden_spear: 3, iron_spear: 5, diamond_spear: 6, netherite_spear: 7,
};

export const TOOL_KINDS = ["pickaxe", "axe", "shovel", "sword"];

export function toolInfo(slug) {
    if (OTHER_WEAPONS[slug]) return { tier: null, kind: "sword", basePower: OTHER_WEAPONS[slug] };
    const match = TOOL_PATTERN.exec(slug);
    if (!match) return null;
    const [, tier, kind] = match;
    return { tier, kind, basePower: kind === "sword" ? SWORD_DAMAGE[tier] : TIER_POWER[tier] };
}

export function blockToolKind(slug) {
    if (/_(log|stem)$/.test(slug)) return "axe";
    return SHOVEL_BLOCKS.has(slug) ? "shovel" : "pickaxe";
}

export const isNetherBlock = slug => NETHER_BLOCKS.has(slug);

export const isOreBlock = slug => slug.endsWith("_ore");
