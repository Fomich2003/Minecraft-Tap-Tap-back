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
    ["crimson_stem", 2000, self("crimson_stem")],
    ["warped_stem", 2000, self("warped_stem")],
    ["netherrack", 1500, self("netherrack")],
    ["gold_ore", 8000, self("raw_gold")],
    ["redstone_ore", 6000, self("redstone")],
    ["lapis_ore", 7000, self("lapis_lazuli")],
    ["nether_quartz_ore", 9000, self("quartz")],
    ["end_stone", 5000, self("end_stone")],
    ["obsidian", 8000, self("obsidian")],
    ["diamond_ore", 50000, self("diamond")],
    ["emerald_ore", 35000, self("emerald")],
    ["ancient_debris", 120000, self("ancient_debris")],
    // Поверхня: їжа й рослини
    ["oak_leaves", 150, [["stick", 60], ["oak_sapling", 25], ["apple", 15]]],
    ["hay_block", 250, [["wheat", 80], ["wheat_seeds", 20]]],
    ["clay", 300, [["clay_ball", 100]]],
    ["snow_block", 300, [["snowball", 100]]],
    ["melon", 400, [["melon_slice", 100]]],
    ["pumpkin", 400, [["pumpkin", 70], ["pumpkin_seeds", 30]]],
    ["cactus", 500, self("cactus")],
    // Печери
    ["tuff", 1200, self("tuff")],
    ["calcite", 1500, self("calcite")],
    ["dripstone_block", 2000, [["pointed_dripstone", 100]]],
    ["amethyst_block", 4000, [["amethyst_shard", 100]]],
    // Глибини
    ["deepslate", 4000, self("cobbled_deepslate")],
    ["sculk", 12000, [["sculk", 90], ["echo_shard", 10]]],
    // Незер
    ["nether_gold_ore", 2500, [["gold_nugget", 100]]],
    ["soul_sand", 3000, self("soul_sand")],
    ["basalt", 3000, self("basalt")],
    ["blackstone", 3500, self("blackstone")],
    ["magma_block", 5000, self("magma_block")],
    ["nether_wart_block", 6000, [["nether_wart", 100]]],
    ["glowstone", 7000, [["glowstone_dust", 100]]],
    // Край
    ["purpur_block", 15000, [["popped_chorus_fruit", 100]]],
    ["chorus_flower", 20000, [["chorus_fruit", 100]]],
].map(([slug, price, drops, extra]) => ({ slug, price, drops, isFirst: false, ...extra }));

// Ціна в коді важливіша за збережену в каталозі: баланс змінюється без імпорту в базу
const priceBySlug = new Map(TAP_BLOCKS.map(block => [block.slug, block.price]));

export const tapBlockPrice = (slug, stored = 0) => priceBySlug.get(slug) ?? stored;

// Кількість тапів до дропа залежить від міцності блока
export function tapsToBreak(hardness) {
    return Math.min(100, Math.max(1, Math.ceil((hardness ?? 1) * 2)));
}
