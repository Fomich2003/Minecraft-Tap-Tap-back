// Гравець спускається згори донизу: нова локація кожні 15 рівнів досвіду. Куплене раніше лишається доступним.
export const LOCATIONS = [
    { id: "surface", level: 0 },
    { id: "caves", level: 15 },
    { id: "depths", level: 30 },
    { id: "nether", level: 45 },
    { id: "end", level: 60 },
];

const MEMBERS = {
    caves: [
        "copper_ore", "iron_ore", "lapis_ore", "tuff", "calcite", "dripstone_block", "amethyst_block",
        "zombie", "skeleton", "spider", "creeper", "slime", "drowned",
    ],
    depths: [
        "deepslate", "gold_ore", "redstone_ore", "diamond_ore", "emerald_ore", "obsidian", "sculk",
        "witch", "enderman", "phantom", "guardian",
    ],
    nether: [
        "netherrack", "crimson_stem", "warped_stem", "nether_quartz_ore", "nether_gold_ore", "glowstone", "soul_sand",
        "basalt", "blackstone", "magma_block", "nether_wart_block", "ancient_debris",
        "blaze", "piglin", "hoglin", "magma_cube", "ghast", "wither_skeleton", "wither",
    ],
    end: ["end_stone", "purpur_block", "chorus_flower", "shulker", "ender_dragon"],
};

const locationBySlug = new Map(Object.entries(MEMBERS).flatMap(([id, slugs]) => slugs.map(slug => [slug, LOCATIONS.find(entry => entry.id === id)])));

export const locationOf = slug => locationBySlug.get(slug) ?? LOCATIONS[0];
