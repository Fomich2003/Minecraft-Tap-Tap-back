// Ручні ціни ресурсів. Усе інше виводиться з вартості рецепта.
export const FIXED_PRICES = {
    coal: 20, charcoal: 20, raw_copper: 40, copper_ingot: 45, raw_iron: 100, iron_ingot: 120, iron_nugget: 14,
    raw_gold: 300, gold_ingot: 350, gold_nugget: 39, redstone: 30, lapis_lazuli: 60, quartz: 50, amethyst_shard: 80,
    diamond: 2000, emerald: 1000, ancient_debris: 8000, netherite_scrap: 9000, nether_star: 50000, dragon_egg: 100000,
    elytra: 60000, heart_of_the_sea: 40000, totem_of_undying: 30000, shulker_shell: 5000, ender_pearl: 500,
    blaze_rod: 800, ghast_tear: 800, enchanted_golden_apple: 40000, prismarine_shard: 40, prismarine_crystals: 60,
    nautilus_shell: 800, breeze_rod: 900, potion: 5, water_bucket: 150, lava_bucket: 200, milk_bucket: 200, bedrock: 500000,
};

// Руда коштує не менше за те, що з неї виплавляється
export const ORE_PRICES = {
    coal_ore: 30, deepslate_coal_ore: 30, copper_ore: 60, deepslate_copper_ore: 60, iron_ore: 150, deepslate_iron_ore: 150,
    gold_ore: 450, deepslate_gold_ore: 450, nether_gold_ore: 450, redstone_ore: 45, deepslate_redstone_ore: 45,
    lapis_ore: 90, deepslate_lapis_ore: 90, nether_quartz_ore: 75, diamond_ore: 3000, deepslate_diamond_ore: 3000,
    emerald_ore: 1500, deepslate_emerald_ore: 1500,
};

export const RECIPE_MARGIN = 1.15;
export const SELL_RATIO = 0.5;

export const CREATIVE_ONLY = new Set([
    "barrier", "bedrock", "chain_command_block", "command_block", "command_block_minecart", "debug_stick", "end_portal_frame",
    "jigsaw", "knowledge_book", "light", "reinforced_deepslate", "repeating_command_block", "spawner", "structure_block",
    "structure_void", "test_block", "test_instance_block", "trial_spawner", "vault", "budding_amethyst", "frogspawn",
]);

export function basePrice(slug, sources) {
    if (CREATIVE_ONLY.has(slug)) return 100000;
    if (slug.endsWith("_spawn_egg")) return 5000;
    if (slug.endsWith("_smithing_template")) return 15000;
    if (slug.startsWith("music_disc_")) return 5000;
    if (slug.endsWith("_pottery_sherd")) return 1500;
    if (slug.endsWith("_banner_pattern")) return 1000;
    if (slug.endsWith("_map")) return 2000;
    if (slug.endsWith("_bucket")) return 300;
    if (slug.startsWith("infested_")) return 50;
    if (sources.block) return 10;
    if (sources.entity) return 60;
    if (sources.chest) return 1000;
    return 200;
}
