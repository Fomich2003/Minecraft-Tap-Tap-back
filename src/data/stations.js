// Верстаки гри. Ціни задані за прогресом: без покращень 1 тап = 1 монета, щоденна нагорода = 500.
export const STATIONS = [
    { slug: "crafting_table", itemSlug: "crafting_table", uiType: "grid", price: 0, isDefault: true },
    { slug: "campfire", itemSlug: "campfire", uiType: "cooking", price: 500 },
    { slug: "furnace", itemSlug: "furnace", uiType: "cooking", price: 1500, needsFuel: true },
    { slug: "stonecutter", itemSlug: "stonecutter", uiType: "stonecutter", price: 2500 },
    { slug: "smoker", itemSlug: "smoker", uiType: "cooking", price: 3000, needsFuel: true },
    { slug: "loom", itemSlug: "loom", uiType: "loom", price: 3500 },
    { slug: "cartography_table", itemSlug: "cartography_table", uiType: "cartography", price: 4000 },
    { slug: "grindstone", itemSlug: "grindstone", uiType: "grindstone", price: 5000 },
    { slug: "blast_furnace", itemSlug: "blast_furnace", uiType: "cooking", price: 6000, needsFuel: true },
    { slug: "smithing_table", itemSlug: "smithing_table", uiType: "smithing", price: 15000 },
    { slug: "anvil", itemSlug: "anvil", uiType: "anvil", price: 20000 },
    { slug: "brewing_stand", itemSlug: "brewing_stand", uiType: "brewing", price: 25000 },
    { slug: "enchanting_table", itemSlug: "enchanting_table", uiType: "enchanting", price: 40000 },
].map((station, order) => ({ isDefault: false, needsFuel: false, ...station, order }));

// Типи рецептів Minecraft і верстаки, на яких вони виконуються
export const COOKING_STATIONS = {
    "minecraft:smelting": "furnace",
    "minecraft:blasting": "blast_furnace",
    "minecraft:smoking": "smoker",
    "minecraft:campfire_cooking": "campfire",
};
