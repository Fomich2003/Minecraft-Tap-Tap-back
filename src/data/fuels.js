// Час горіння палива в тіках. У даних гри його немає, значення з ванільного FuelValues.
// Запис "#tag" розгортається через теги предметів, деревина Незеру паливом не є.
export const FUEL_BURN_TICKS = [
    ["lava_bucket", 20000], ["coal_block", 16000], ["dried_kelp_block", 4001],
    ["blaze_rod", 2400], ["coal", 1600], ["charcoal", 1600],
    ["#boats", 1200], ["#chest_boats", 1200], ["#wooden_hanging_signs", 800],
    ["#logs", 300], ["#planks", 300], ["#bamboo_blocks", 300], ["#wooden_stairs", 300],
    ["#wooden_trapdoors", 300], ["#wooden_pressure_plates", 300], ["#wooden_fences", 300],
    ["#fence_gates", 300], ["#banners", 300], ["bamboo_mosaic", 300], ["bamboo_mosaic_stairs", 300],
    ["note_block", 300], ["bookshelf", 300], ["chiseled_bookshelf", 300], ["lectern", 300],
    ["jukebox", 300], ["chest", 300], ["trapped_chest", 300], ["crafting_table", 300],
    ["cartography_table", 300], ["fletching_table", 300], ["smithing_table", 300], ["loom", 300],
    ["composter", 300], ["barrel", 300], ["beehive", 300], ["bee_nest", 300],
    ["daylight_detector", 300], ["bow", 300], ["fishing_rod", 300], ["crossbow", 300],
    ["ladder", 300], ["mangrove_roots", 300],
    ["#wooden_signs", 200], ["#wooden_doors", 200], ["wooden_pickaxe", 200], ["wooden_axe", 200],
    ["wooden_shovel", 200], ["wooden_hoe", 200], ["wooden_sword", 200],
    ["#wooden_slabs", 150], ["bamboo_mosaic_slab", 150],
    ["#wool", 100], ["#wooden_buttons", 100], ["#saplings", 100], ["stick", 100], ["bowl", 100],
    ["dead_bush", 100], ["azalea", 100], ["flowering_azalea", 100],
    ["#wool_carpets", 67], ["bamboo", 50], ["scaffolding", 50],
];

export const NON_FUEL_TAGS = ["non_flammable_wood"];

export const CRAFTING_REMAINDERS = {
    milk_bucket: "bucket",
    water_bucket: "bucket",
    lava_bucket: "bucket",
    powder_snow_bucket: "bucket",
    honey_bottle: "glass_bottle",
    dragon_breath: "glass_bottle",
};
