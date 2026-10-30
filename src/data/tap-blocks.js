// Блоки, по яких можна тапати. Дроп той самий, що й у ванільному видобутку без шовкового дотику.
const self = slug => [[slug, 100]];

export const TAP_BLOCKS = [
    ["oak_log", 0, self("oak_log"), { isFirst: true }],
    ["dirt", 100, self("dirt")],
    ["sand", 200, self("sand")],
    ["gravel", 300, [["gravel", 90], ["flint", 10]]],
    ["stone", 500, self("cobblestone")],
    ["birch_log", 1000, self("birch_log")],
    ["spruce_log", 1000, self("spruce_log")],
    ["jungle_log", 1000, self("jungle_log")],
    ["acacia_log", 1000, self("acacia_log")],
    ["dark_oak_log", 1000, self("dark_oak_log")],
    ["mangrove_log", 1000, self("mangrove_log")],
    ["cherry_log", 1000, self("cherry_log")],
    ["pale_oak_log", 1000, self("pale_oak_log")],
    ["poplar_log", 1000, self("poplar_log")],
    ["coal_ore", 1500, self("coal")],
    ["copper_ore", 2000, self("raw_copper")],
    ["iron_ore", 3000, self("raw_iron")],
    ["crimson_stem", 5000, self("crimson_stem")],
    ["warped_stem", 5000, self("warped_stem")],
    ["netherrack", 5000, self("netherrack")],
    ["gold_ore", 8000, self("raw_gold")],
    ["redstone_ore", 10000, self("redstone")],
    ["lapis_ore", 12000, self("lapis_lazuli")],
    ["nether_quartz_ore", 15000, self("quartz")],
    ["end_stone", 20000, self("end_stone")],
    ["obsidian", 30000, self("obsidian")],
    ["diamond_ore", 50000, self("diamond")],
    ["emerald_ore", 60000, self("emerald")],
    ["ancient_debris", 200000, self("ancient_debris")],
].map(([slug, price, drops, extra]) => ({ slug, price, drops, isFirst: false, ...extra }));

// Кількість тапів до дропа залежить від міцності блока
export function tapsToBreak(hardness) {
    return Math.min(100, Math.max(1, Math.ceil((hardness ?? 1) * 2)));
}
