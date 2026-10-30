import { CREATIVE_ONLY, FIXED_PRICES, ORE_PRICES, RECIPE_MARGIN, SELL_RATIO, basePrice } from "../data/pricing.js";
import { COOKING_STATIONS, STATIONS } from "../data/stations.js";
import { FUEL_BURN_TICKS, NON_FUEL_TAGS } from "../data/fuels.js";
import { TAP_BLOCKS, tapsToBreak } from "../data/tap-blocks.js";
import { enchantabilityOf } from "../data/enchantability.js";

const strip = value => value.replace(/^minecraft:/, "");

function titleFromSlug(slug) {
    return slug.split("_").map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
}

function stripComponents(components) {
    if (!components) return undefined;
    return Object.fromEntries(Object.entries(components).map(([key, value]) => [strip(key), value]));
}

function createTagReader(jar, kind) {
    const cache = new Map();
    const read = name => {
        const tag = strip(name);
        if (cache.has(tag)) return cache.get(tag);
        cache.set(tag, []);
        const data = jar.json(`data/minecraft/tags/${kind}/${tag}.json`);
        const values = [];
        for (const entry of data?.values ?? []) {
            const id = typeof entry === "string" ? entry : entry.id;
            if (id.startsWith("#")) values.push(...read(id.slice(1)));
            else values.push(strip(id));
        }
        cache.set(tag, [...new Set(values)]);
        return cache.get(tag);
    };
    return read;
}

function createIngredientReader(itemTag) {
    const read = ingredient => {
        if (ingredient == null) return [];
        if (Array.isArray(ingredient)) return [...new Set(ingredient.flatMap(read))];
        if (typeof ingredient === "string") return ingredient.startsWith("#") ? itemTag(ingredient.slice(1)) : [strip(ingredient)];
        if (ingredient.tag) return itemTag(ingredient.tag);
        if (ingredient.item) return [strip(ingredient.item)];
        if (ingredient.items) return read(ingredient.items);
        return [];
    };
    return read;
}

function itemType(slug, { isBlock, food, durability }) {
    if (/_ore$|^ancient_debris$/.test(slug)) return "ores";
    if (/(^|_)(potion)$|^experience_bottle$|^ominous_bottle$/.test(slug)) return "potion";
    if (/(sword|bow|crossbow|trident|mace|spear)$/.test(slug)) return "weapon";
    if (/(helmet|chestplate|leggings|boots|elytra|shield|horse_armor|wolf_armor|nautilus_armor)$/.test(slug)) return "armor";
    if (durability > 0) return "tool";
    if (food) return "food";
    if (["coal", "charcoal", "blaze_rod", "blaze_powder"].includes(slug)) return "fuel";
    if (/(ingot|nugget)$/.test(slug)) return "ingot";
    return isBlock ? "block" : "material";
}

// Предмети, яких ще немає в minecraft-data 26.1, належать до родин зі спільними правилами
function inferStackSize(slug) {
    if (/_boat$|_chest_boat$|_bed$|^music_disc_|_bucket$/.test(slug)) return 1;
    if (/_sign$|_banner$/.test(slug)) return 16;
    return 64;
}

function collectLootSources(jar, itemTag) {
    const sources = new Map();
    const note = (slug, kind) => {
        if (!sources.has(slug)) sources.set(slug, {});
        sources.get(slug)[kind] = true;
    };
    const walk = (value, kind) => {
        if (Array.isArray(value)) return value.forEach(entry => walk(entry, kind));
        if (!value || typeof value !== "object") return;
        if (value.type === "minecraft:item" && value.name) note(strip(value.name), kind);
        if (value.type === "minecraft:tag" && value.name) itemTag(value.name).forEach(slug => note(slug, kind));
        Object.values(value).forEach(entry => walk(entry, kind));
    };
    for (const name of jar.names) {
        const match = name.match(/^data\/minecraft\/loot_table\/([^/]+)\/.*\.json$/);
        if (!match) continue;
        const kind = match[1] === "blocks" ? "block" : match[1] === "entities" ? "entity" : match[1] === "chests" ? "chest" : "other";
        walk(jar.json(name), kind);
    }
    return sources;
}

// Гра відкидає порожні ряди й колонки навколо шаблону: " B " це рецепт шириною 1
function shrinkPattern(pattern) {
    const width = Math.max(...pattern.map(row => row.length));
    const rows = pattern.map(row => row.padEnd(width)).filter(row => row.trim());
    const usedColumns = [...Array(width).keys()].filter(column => rows.some(row => row[column] !== " "));
    const first = usedColumns[0];
    const last = usedColumns[usedColumns.length - 1];
    return rows.map(row => row.slice(first, last + 1));
}

function buildRecipes(jar, ingredient) {
    const recipes = [];
    const skipped = [];
    const resultOf = data => {
        const value = data.result ?? data.output;
        if (typeof value === "string") return { slug: strip(value), quantity: 1 };
        return value?.id ? { slug: strip(value.id), quantity: value.count ?? 1, components: stripComponents(value.components) } : null;
    };

    for (const name of jar.names) {
        const match = name.match(/^data\/minecraft\/recipe\/(.*)\.json$/);
        if (!match) continue;
        const recipeKey = match[1].replaceAll("/", "_");
        const data = jar.json(name);
        const base = { recipeKey, group: data.group, result: resultOf(data) };

        if (data.type === "minecraft:crafting_shaped") {
            const rows = shrinkPattern(data.pattern);
            const pattern = rows.flatMap(row => [...row].map(key => (key === " " ? null : ingredient(data.key[key]))));
            recipes.push({ ...base, station: "crafting_table", kind: "shaped", width: rows[0].length, height: rows.length, pattern });
        } else if (data.type === "minecraft:crafting_shapeless") {
            recipes.push({ ...base, station: "crafting_table", kind: "shapeless", ingredients: data.ingredients.map(ingredient) });
        } else if (COOKING_STATIONS[data.type]) {
            recipes.push({ ...base, station: COOKING_STATIONS[data.type], kind: "cooking", input: ingredient(data.ingredient), cookTime: data.cookingtime ?? 200, experience: data.experience ?? 0 });
        } else if (data.type === "minecraft:stonecutting") {
            recipes.push({ ...base, station: "stonecutter", kind: "stonecutting", input: ingredient(data.ingredient) });
        } else if (data.type === "minecraft:smithing_transform") {
            recipes.push({ ...base, station: "smithing_table", kind: "smithing_transform", template: ingredient(data.template), base: ingredient(data.base), addition: ingredient(data.addition) });
        } else if (data.type === "minecraft:smithing_trim") {
            recipes.push({ recipeKey, station: "smithing_table", kind: "smithing_trim", template: ingredient(data.template), base: ingredient(data.base), addition: ingredient(data.addition), data: { pattern: strip(data.pattern) } });
        } else if (data.type === "minecraft:brewing") {
            recipes.push({
                recipeKey, station: "brewing_stand", kind: "brewing", result: resultOf(data),
                brewing: {
                    item: strip(data.input.item),
                    potion: strip(data.input.potion_contents.potions),
                    reagent: strip(data.reagent.item),
                    outputItem: strip(data.output.id),
                    outputPotion: strip(data.output.components["minecraft:potion_contents"].potion),
                },
            });
        } else if (data.type === "minecraft:crafting_transmute") {
            recipes.push({
                ...base, station: "crafting_table", kind: "transmute",
                data: {
                    input: ingredient(data.input), material: ingredient(data.material),
                    minMaterial: data.material_count?.min ?? 1, maxMaterial: data.material_count?.max ?? 1,
                    addMaterialCount: Boolean(data.add_material_count_to_result),
                },
            });
        } else if (/crafting_(special_|dye|imbue|decorated_pot)/.test(data.type)) {
            const args = {};
            for (const [key, value] of Object.entries(data)) {
                if (key === "type" || key === "group" || key === "result") continue;
                args[key] = key === "shapes"
                    ? Object.fromEntries(Object.entries(value).map(([shape, entry]) => [shape, ingredient(entry)]))
                    : ingredient(value);
            }
            recipes.push({ ...base, station: "crafting_table", kind: "special", specialType: strip(data.type).replace("crafting_special_", "").replace("crafting_", ""), data: args });
        } else {
            skipped.push(`${recipeKey} (${data.type})`);
        }
    }
    return { recipes, skipped };
}

function buildEnchantments(jar, ukrainian, itemTag) {
    const enchantmentTag = createTagReader(jar, "enchantment");
    const inTable = new Set(enchantmentTag("in_enchanting_table"));
    const curses = new Set(enchantmentTag("curse"));
    const list = {};
    for (const name of jar.names) {
        const match = name.match(/^data\/minecraft\/enchantment\/([^/]+)\.json$/);
        if (!match) continue;
        const data = jar.json(name);
        const items = value => (value ? (Array.isArray(value) ? value.map(strip) : value.startsWith("#") ? itemTag(value.slice(1)) : [strip(value)]) : []);
        list[match[1]] = {
            name: ukrainian[`enchantment.minecraft.${match[1]}`] ?? titleFromSlug(match[1]),
            maxLevel: data.max_level, weight: data.weight, anvilCost: data.anvil_cost,
            minCost: data.min_cost, maxCost: data.max_cost,
            supported: items(data.supported_items), primary: items(data.primary_items ?? data.supported_items),
            exclusive: data.exclusive_set ? (typeof data.exclusive_set === "string" ? (data.exclusive_set.startsWith("#") ? enchantmentTag(data.exclusive_set.slice(1)) : [strip(data.exclusive_set)]) : data.exclusive_set.map(strip)) : [],
            inTable: inTable.has(match[1]), curse: curses.has(match[1]),
        };
    }
    return list;
}

function buildBannerPatterns(jar, ukrainian) {
    const patternTag = createTagReader(jar, "banner_pattern");
    const free = new Set(patternTag("no_item_required"));
    const byItem = {};
    for (const name of jar.names) {
        const match = name.match(/^data\/minecraft\/tags\/banner_pattern\/pattern_item\/(.+)\.json$/);
        if (match) byItem[`${match[1]}_banner_pattern`] = patternTag(`pattern_item/${match[1]}`);
    }
    const patterns = {};
    for (const name of jar.names) {
        const match = name.match(/^data\/minecraft\/banner_pattern\/([^/]+)\.json$/);
        if (!match) continue;
        const data = jar.json(name);
        patterns[match[1]] = { name: ukrainian[`${data.translation_key}.white`] ?? titleFromSlug(match[1]), free: free.has(match[1]) };
    }
    return { patterns, byItem };
}

function buildFuels(itemTag) {
    const excluded = new Set(NON_FUEL_TAGS.flatMap(tag => itemTag(tag)));
    const fuels = {};
    for (const [entry, ticks] of FUEL_BURN_TICKS) {
        const slugs = entry.startsWith("#") ? itemTag(entry.slice(1)) : [entry];
        for (const slug of slugs) if (!excluded.has(slug) && fuels[slug] === undefined) fuels[slug] = ticks;
    }
    return fuels;
}

function assignPrices(items, recipes, sources) {
    const price = new Map();
    const frozen = new Set();
    const known = new Set(items.map(item => item.slug));
    const freeze = (slug, value) => { if (known.has(slug)) { price.set(slug, value); frozen.add(slug); } };

    const producible = new Set(recipes.filter(recipe => recipe.result?.slug && recipe.kind !== "special").map(recipe => recipe.result.slug));
    Object.entries(FIXED_PRICES).forEach(([slug, value]) => freeze(slug, value));
    Object.entries(ORE_PRICES).forEach(([slug, value]) => freeze(slug, value));
    for (const item of items) {
        if (!producible.has(item.slug) && !frozen.has(item.slug)) freeze(item.slug, basePrice(item.slug, sources.get(item.slug) ?? {}));
    }

    const cookable = recipes.filter(recipe => recipe.result?.slug && recipe.kind !== "special" && recipe.kind !== "brewing" && recipe.kind !== "transmute").map(recipe => ({
        out: recipe.result.slug,
        count: recipe.result.quantity ?? 1,
        inputs: recipe.kind === "shaped" ? recipe.pattern.filter(Boolean)
            : recipe.kind === "shapeless" ? recipe.ingredients
                : recipe.kind === "smithing_transform" ? [recipe.template, recipe.base, recipe.addition]
                    : [recipe.input],
    })).filter(recipe => recipe.inputs.length);

    const relax = () => {
        let changed = true;
        for (let pass = 0; changed && pass < 40; pass += 1) {
            changed = false;
            for (const recipe of cookable) {
                if (frozen.has(recipe.out)) continue;
                const parts = recipe.inputs.map(group => Math.min(...group.map(slug => price.get(slug) ?? Infinity)));
                if (parts.some(value => !Number.isFinite(value))) continue;
                const cost = Math.max(1, Math.ceil(parts.reduce((sum, value) => sum + value, 0) * RECIPE_MARGIN / recipe.count));
                if (!price.has(recipe.out) || cost < price.get(recipe.out)) { price.set(recipe.out, cost); changed = true; }
            }
        }
    };
    relax();

    // Цикли на кшталт пшениця/сіно не мають ціни: задаємо базову предмету, який частіше використовується
    const uses = new Map();
    for (const recipe of cookable) for (const group of recipe.inputs) for (const slug of group) uses.set(slug, (uses.get(slug) ?? 0) + 1);
    for (;;) {
        const left = items.filter(item => !price.has(item.slug)).sort((a, b) => (uses.get(b.slug) ?? 0) - (uses.get(a.slug) ?? 0));
        if (!left.length) break;
        freeze(left[0].slug, basePrice(left[0].slug, sources.get(left[0].slug) ?? {}));
        relax();
    }

    for (const item of items) {
        item.marketPrice = price.get(item.slug);
        item.sellPrice = Math.floor(item.marketPrice * SELL_RATIO);
        item.buyable = true;
    }
}

export function buildCatalog({ jar, ukrainian, properties }) {
    const itemTag = createTagReader(jar, "item");
    const ingredient = createIngredientReader(itemTag);
    const sources = collectLootSources(jar, itemTag);
    const propertiesBySlug = new Map(properties.items.map(item => [item.name, item]));
    const foods = new Map(properties.foods.map(food => [food.name, food]));
    const blocks = new Map(properties.blocks.map(block => [block.name, block]));
    const english = jar.json("assets/minecraft/lang/en_us.json");

    const slugs = jar.names.map(name => name.match(/^assets\/minecraft\/items\/([^/]+)\.json$/)?.[1]).filter(Boolean).filter(slug => slug !== "air").sort();
    const items = slugs.map(slug => {
        const known = propertiesBySlug.get(slug);
        const food = foods.get(slug);
        const isBlock = Boolean(ukrainian[`block.minecraft.${slug}`]);
        const maxStack = known?.stackSize ?? inferStackSize(slug);
        const durability = known?.maxDurability ?? 0;
        return {
            slug,
            name: ukrainian[`item.minecraft.${slug}`] ?? ukrainian[`block.minecraft.${slug}`] ?? english[`item.minecraft.${slug}`] ?? english[`block.minecraft.${slug}`] ?? titleFromSlug(slug),
            nameEn: english[`item.minecraft.${slug}`] ?? english[`block.minecraft.${slug}`] ?? titleFromSlug(slug),
            type: itemType(slug, { isBlock, food, durability }),
            isBlock,
            stackable: maxStack > 1,
            maxStack,
            maxDurability: durability,
            repairWith: known?.repairWith ?? [],
            enchantability: enchantabilityOf(slug),
            food: food ? { nutrition: food.foodPoints, saturation: food.saturation } : undefined,
            hardness: blocks.get(slug)?.hardness ?? undefined,
            creativeOnly: CREATIVE_ONLY.has(slug),
            icon: `/items/${slug}.png`,
        };
    });

    const { recipes, skipped } = buildRecipes(jar, ingredient);
    assignPrices(items, recipes, sources);

    const stations = STATIONS.map(station => ({ ...station, name: ukrainian[`block.minecraft.${station.itemSlug}`] ?? titleFromSlug(station.itemSlug) }));
    const known = new Set(slugs);
    const tapBlocks = TAP_BLOCKS.filter(block => known.has(block.slug) && block.drops.every(([slug]) => known.has(slug)))
        .map(block => ({ ...block, tapsToBreak: tapsToBreak(blocks.get(block.slug)?.hardness ?? blocks.get("oak_log").hardness) }));

    const gameData = {
        enchantments: buildEnchantments(jar, ukrainian, itemTag),
        bannerPatterns: buildBannerPatterns(jar, ukrainian),
        trimMaterials: Object.fromEntries(jar.names.map(name => name.match(/^data\/minecraft\/trim_material\/([^/]+)\.json$/)?.[1]).filter(Boolean).map(id => [id, ukrainian[`trim_material.minecraft.${id}`] ?? titleFromSlug(id)])),
        trimPatterns: Object.fromEntries(jar.names.map(name => name.match(/^data\/minecraft\/trim_pattern\/([^/]+)\.json$/)?.[1]).filter(Boolean).map(id => [id, ukrainian[`trim_pattern.minecraft.${id}`] ?? titleFromSlug(id)])),
        fuels: buildFuels(itemTag),
        potionNames: Object.fromEntries(Object.entries(ukrainian).filter(([key]) => key.startsWith("item.minecraft.potion.effect.")).map(([key, value]) => [key.slice("item.minecraft.potion.effect.".length), value])),
        tags: {
            dyes: itemTag("dyes"),
            banners: itemTag("banners"),
            trimMaterials: itemTag("trim_materials"),
        },
    };

    return { items, recipes, skipped, stations, tapBlocks, gameData };
}
