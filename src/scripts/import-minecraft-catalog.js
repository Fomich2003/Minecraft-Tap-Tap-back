import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { inflateRawSync } from "node:zlib";
import Item from "../models/Item.model.js";
import Recipe from "../models/Recipe.model.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(scriptDir, "../..");
const projectDir = path.resolve(serverDir, "..");
const minecraftDir = process.env.MINECRAFT_DIR || path.join(process.env.APPDATA || "", ".minecraft");
const version = process.env.MINECRAFT_VERSION || "1.21.4";
const dryRun = process.argv.includes("--dry-run");
const objectDirectory = path.join(minecraftDir, "assets", "objects");
const assetIndexDirectory = path.join(minecraftDir, "assets", "indexes");
const iconDirectory = path.join(serverDir, "src", "assets", "items");
const localItemsPath = path.join(projectDir, "MinecraftTapTap.items.json");
const ignoredTextureNames = new Set();
const knownNames = {
    air: "Повітря", oak_planks: "Дубові дошки", spruce_planks: "Ялинові дошки",
    birch_planks: "Березові дошки", jungle_planks: "Тропічні дошки", acacia_planks: "Акацієві дошки",
    cherry_planks: "Вишневі дошки", dark_oak_planks: "Темнодубові дошки", mangrove_planks: "Мангрові дошки",
    crimson_planks: "Багряні дошки", warped_planks: "Химерні дошки", stick: "Палиця", crafting_table: "Верстак",
    iron_ingot: "Залізний злиток", gold_ingot: "Золотий злиток", copper_ingot: "Мідний злиток",
    diamond: "Алмаз", emerald: "Смарагд", coal: "Вугілля", charcoal: "Деревне вугілля",
    redstone: "Редстоун", lapis_lazuli: "Лазурит", quartz: "Кварц", netherite_ingot: "Незеритовий злиток",
    oak_log: "Дубове колоду", oak_wood: "Дубова деревина", cobblestone: "Булижник", stone: "Камінь",
    raw_iron: "Необроблене залізо", raw_gold: "Необроблене золото", raw_copper: "Необроблена мідь",
};

function titleFromSlug(slug) {
    return slug.split("_").map(word => word ? word[0].toUpperCase() + word.slice(1) : "").join(" ");
}

function itemType(slug) {
    if (/(pickaxe|axe|shovel|hoe|sword|bow|crossbow|trident|shield|fishing_rod|flint_and_steel|shears|brush|spyglass|compass|clock)$/.test(slug)) return "tool";
    if (/(helmet|chestplate|leggings|boots|_head|_skull|elytra)$/.test(slug)) return "armor";
    if (/(ore|ancient_debris)$/.test(slug)) return "ores";
    if (/(block|log|wood|planks|stone|dirt|sand|wool|leaves|glass|slab|stairs|wall|fence|door|trapdoor|ore)$/.test(slug)) return "block";
    if (["coal", "charcoal", "blaze_rod", "dried_kelp_block"].includes(slug)) return "fuel";
    if (/(ingot|nugget)$/.test(slug)) return "ingot";
    if (/(planks|log|wood|stone|dirt|sand|wool|leaves|glass|slab|stairs|wall|fence|door|trapdoor|button|pressure_plate|sign|boat|rail|ore|block)$/.test(slug)) return "block";
    return "material";
}

function itemDocument(slug, assetEntries) {
    const asset = assetEntries[`minecraft:textures/item/${slug}.png`]
        || assetEntries[`minecraft:textures/item/item/${slug}.png`]
        || assetEntries[`minecraft:textures/block/${slug}.png`];
    if (!asset) return null;
    const maxStack = /^(sword|pickaxe|axe|shovel|hoe|bow|crossbow|trident|shield|fishing_rod|flint_and_steel|shears|brush|spyglass|compass|clock|helmet|chestplate|leggings|boots|elytra)/.test(slug) ? 1 : 64;
    return { slug, name: titleFromSlug(slug), type: itemType(slug), stackable: maxStack > 1, maxStack, canTap: false, canDrop: null, icon: `/items/${slug}.png`, price: 0, isFirst: false };
}

async function readJson(filePath) {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJarEntries(jarPath) {
    const jar = await fs.readFile(jarPath);
    let endOffset = -1;
    for (let offset = jar.length - 22; offset >= Math.max(0, jar.length - 65557); offset -= 1) {
        if (jar.readUInt32LE(offset) === 0x06054b50) { endOffset = offset; break; }
    }
    if (endOffset < 0) throw new Error("Could not read Minecraft JAR directory");

    const entries = new Map();
    const entryCount = jar.readUInt16LE(endOffset + 10);
    let cursor = jar.readUInt32LE(endOffset + 16);
    for (let index = 0; index < entryCount; index += 1) {
        if (jar.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Invalid Minecraft JAR directory entry");
        const method = jar.readUInt16LE(cursor + 10);
        const compressedSize = jar.readUInt32LE(cursor + 20);
        const nameLength = jar.readUInt16LE(cursor + 28);
        const extraLength = jar.readUInt16LE(cursor + 30);
        const commentLength = jar.readUInt16LE(cursor + 32);
        const localHeaderOffset = jar.readUInt32LE(cursor + 42);
        const name = jar.toString("utf8", cursor + 46, cursor + 46 + nameLength);
        const localNameLength = jar.readUInt16LE(localHeaderOffset + 26);
        const localExtraLength = jar.readUInt16LE(localHeaderOffset + 28);
        const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
        const compressed = jar.subarray(dataOffset, dataOffset + compressedSize);
        entries.set(name, method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null);
        cursor += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

async function main() {
    if (!minecraftDir || !(await fs.stat(minecraftDir).catch(() => null))) {
        throw new Error(`Minecraft directory not found: ${minecraftDir}`);
    }
    const versionJar = path.join(minecraftDir, "versions", version, `${version}.jar`);
    if (!(await fs.stat(versionJar).catch(() => null))) throw new Error(`Minecraft ${version} JAR is missing: ${versionJar}`);

    const existingRows = JSON.parse(await fs.readFile(localItemsPath, "utf8"));
    const existingBySlug = new Map(existingRows.filter(row => row.slug).map(row => [row.slug, row]));
    const jarEntries = await readJarEntries(versionJar);
    const versionMeta = await readJson(path.join(minecraftDir, "versions", version, `${version}.json`));
    const assetIndex = await readJson(path.join(assetIndexDirectory, `${versionMeta.assetIndex.id}.json`));
    const ukrainianLang = assetIndex.objects["minecraft/lang/uk_ua.json"];
    const englishLang = assetIndex.objects["minecraft/lang/en_us.json"];
    const readLanguage = async metadata => {
        if (!metadata) return {};
        const objectPath = path.join(objectDirectory, metadata.hash.slice(0, 2), metadata.hash);
        return JSON.parse(await fs.readFile(objectPath, "utf8"));
    };
    const translations = await readLanguage(ukrainianLang);
    const englishTranslations = await readLanguage(englishLang);
    const itemSlugs = new Set();

    for (const assetPath of jarEntries.keys()) {
        const itemMatch = assetPath.match(/^assets\/minecraft\/items\/([^/]+)\.json$/);
        if (itemMatch && !ignoredTextureNames.has(itemMatch[1])) itemSlugs.add(itemMatch[1]);
    }

    const additions = [...itemSlugs].sort().map(slug => {
        const item = {
            slug,
            name: titleFromSlug(slug),
            type: itemType(slug),
            stackable: !/(sword|pickaxe|axe|shovel|hoe|helmet|chestplate|leggings|boots|bow|crossbow|trident|shield|fishing_rod|flint_and_steel|shears|brush|spyglass|elytra|horse_armor|saddle|minecart|compass)$/.test(slug),
            maxStack: /(sword|pickaxe|axe|shovel|hoe|helmet|chestplate|leggings|boots|bow|crossbow|trident|shield|fishing_rod|flint_and_steel|shears|brush|spyglass|elytra|horse_armor|saddle|minecart|compass)$/.test(slug) ? 1 : 64,
            canTap: false,
            canDrop: null,
            icon: `/items/${slug}.png`,
            price: 0,
            isFirst: false,
        };
        const translation = translations[`item.minecraft.${slug}`] || translations[`block.minecraft.${slug}`]
            || englishTranslations[`item.minecraft.${slug}`] || englishTranslations[`block.minecraft.${slug}`];
        if (translation) item.name = translation;
        const itemDefinition = JSON.parse(jarEntries.get(`assets/minecraft/items/${slug}.json`).toString("utf8"));
        const textureCandidates = JSON.stringify(itemDefinition).match(/(?:minecraft:)?(?:item|block)\/[a-z0-9_]+/g) || [];
        const texturePath = textureCandidates.map(value => value.replace(/^minecraft:/, ""))
            .map(value => [`assets/minecraft/textures/${value}.png`, `assets/minecraft/textures/${value}.png.mcmeta`].find(candidate => jarEntries.has(candidate)))
            .find(Boolean);
        const direct = `assets/minecraft/textures/item/${slug}.png`;
        const nested = `assets/minecraft/textures/item/item/${slug}.png`;
        const block = `assets/minecraft/textures/block/${slug}.png`;
        const animatedFrame = slug === "clock" || slug === "compass" || slug === "recovery_compass"
            ? `assets/minecraft/textures/item/${slug}_00.png`
            : null;
        item.__iconSource = [direct, nested, block].find(candidate => jarEntries.has(candidate))
            || (animatedFrame && jarEntries.has(animatedFrame) ? animatedFrame : null)
            || texturePath
            || `assets/minecraft/textures/misc/unknown_pack.png`;
        return item;
    }).filter(Boolean);
    const newItems = additions.filter(item => !existingBySlug.has(item.slug));
    const allSlugs = new Set([...existingBySlug.keys(), ...additions.map(item => item.slug)]);
    const recipeAssetFiles = [...jarEntries.keys()].filter(key => /^data\/minecraft\/recipe\//.test(key) && key.endsWith(".json"));
    const itemBySlug = new Map(additions.map(item => [item.slug, item]));
    for (const [slug, row] of existingBySlug) {
        itemBySlug.set(slug, { ...row, maxStack: row.maxStack ?? 64 });
    }

    const recipeDocuments = [];
    let skippedRecipes = 0;
    const skippedExamples = [];
    const skipRecipe = (assetPath, reason) => {
        skippedRecipes += 1;
        if (skippedExamples.length < 12) skippedExamples.push({ recipe: assetPath, reason });
    };
    const tagCache = new Map();
    const resolveIngredient = async (ingredient) => {
        if (Array.isArray(ingredient)) {
            return [...new Set((await Promise.all(ingredient.map(resolveIngredient))).flat())];
        }
        if (typeof ingredient === "string" && ingredient.startsWith("#")) {
            return resolveIngredient({ tag: ingredient.slice(1) });
        }
        if (Array.isArray(ingredient?.items)) {
            return [...new Set((await Promise.all(ingredient.items.map(resolveIngredient))).flat())];
        }
        const direct = typeof ingredient === "string" ? ingredient : ingredient?.item;
        if (direct) {
            const slug = direct.replace(/^minecraft:/, "");
            return allSlugs.has(slug) ? [slug] : [];
        }
        const tagName = ingredient?.tag?.replace(/^minecraft:/, "");
        if (!tagName) return [];
        if (tagCache.has(tagName)) return tagCache.get(tagName);
        const entryName = `data/minecraft/tags/item/${tagName}.json`;
        const raw = jarEntries.get(entryName);
        if (!raw) { tagCache.set(tagName, []); return []; }
        const tagData = JSON.parse(raw.toString("utf8"));
        const resolved = [];
        for (const value of tagData.values || []) {
            if (typeof value === "string") {
                if (value.startsWith("#")) resolved.push(...await resolveIngredient({ tag: value.slice(1) }));
                else {
                    const slug = value.replace(/^minecraft:/, "");
                    if (allSlugs.has(slug)) resolved.push(slug);
                }
            } else if (value?.id) {
                if (value.required === false) continue;
                if (value.id.startsWith("#")) resolved.push(...await resolveIngredient({ tag: value.id.slice(1) }));
                else {
                    const slug = value.id.replace(/^minecraft:/, "");
                    if (allSlugs.has(slug)) resolved.push(slug);
                }
            }
        }
        const unique = [...new Set(resolved)];
        tagCache.set(tagName, unique);
        return unique;
    };

    for (const assetPath of recipeAssetFiles) {
        const data = JSON.parse(jarEntries.get(assetPath).toString("utf8"));
        if (data.type !== "minecraft:crafting_shaped" && data.type !== "minecraft:crafting_shapeless") continue;

        const resultEntry = typeof data.result === "string" ? { id: data.result, count: 1 } : data.result;
        if (!resultEntry?.id || resultEntry.id.startsWith("#")) { skipRecipe(assetPath, "result id missing"); continue; }
        const resultSlug = resultEntry.id.replace(/^minecraft:/, "");
        if (!allSlugs.has(resultSlug)) { skipRecipe(assetPath, `result item missing: ${resultSlug}`); continue; }

        let pattern = Array(9).fill(null);
        let slotGroups = Array(9).fill(null);
        let shapelessIngredients = [];
        if (data.type === "minecraft:crafting_shaped") {
            const keys = data.key || {};
            const rows = data.pattern || [];
            const height = Math.min(3, rows.length);
            const width = Math.min(3, ...rows.map(row => row.length));
            const rowOffset = Math.floor((3 - height) / 2);
            const columnOffset = Math.floor((3 - width) / 2);
            let invalid = false;
            for (let row = 0; row < height; row += 1) {
                for (let column = 0; column < width; column += 1) {
                    const key = rows[row][column];
                    if (key === " ") continue;
                    const ingredient = keys[key];
                    const slugs = await resolveIngredient(ingredient);
                    if (!slugs.length) { invalid = true; continue; }
                    const index = (row + rowOffset) * 3 + column + columnOffset;
                    slotGroups[index] = slugs;
                    pattern[index] = slugs[0];
                }
            }
            if (invalid) { skipRecipe(assetPath, "ingredient could not be resolved"); continue; }
        } else {
            const ingredients = data.ingredients || [];
            const expanded = [];
            let invalid = false;
            for (const ingredient of ingredients) {
                const slugs = await resolveIngredient(ingredient);
                if (!slugs.length) { invalid = true; break; }
                expanded.push(slugs);
            }
            if (invalid || !expanded.length || expanded.length > 9) { skipRecipe(assetPath, "shapeless ingredient could not be resolved"); continue; }
            shapelessIngredients = expanded;
        }

        const recipeKey = `minecraft_${assetPath.slice("data/minecraft/recipe/".length, -5).replaceAll("/", "_")}`;
        recipeDocuments.push({ recipeKey, station: "workbench", result: resultSlug, quantity: resultEntry.count || 1, pattern, slotGroups, shapelessIngredients });
    }

    console.log(`Minecraft version: ${version}`);
    console.log(`Existing local catalog entries: ${existingBySlug.size}`);
    console.log(`Minecraft items with icons: ${additions.length}`);
    console.log(`New catalog entries: ${newItems.length}`);
    console.log(`Workbench recipes parsed: ${recipeDocuments.length} (skipped unsupported/tag-based: ${skippedRecipes})`);
    if (dryRun && skippedExamples.length) console.log(`Skipped examples: ${JSON.stringify(skippedExamples)}`);
    console.log(`Mode: ${dryRun ? "DRY RUN" : "APPLY"}`);

    if (dryRun) return;
    if (!process.env.DB_URL) throw new Error("DB_URL is missing. Add it to server/.env before running this script.");
    await mongoose.connect(process.env.DB_URL, { serverSelectionTimeoutMS: 10000 });
    const itemOps = additions.map(({ __iconSource, ...item }) => {
        const { name, type, stackable, maxStack, icon, ...insertOnlyFields } = item;
        return {
            updateOne: {
                filter: { slug: item.slug },
                update: {
                    $setOnInsert: insertOnlyFields,
                    $set: { name, type, stackable, maxStack, icon },
                },
                upsert: true,
            },
        };
    });
    if (itemOps.length) await Item.bulkWrite(itemOps, { ordered: false });

    const items = await Item.find({ slug: { $in: [...allSlugs] } }, "_id slug").lean();
    const idsBySlug = new Map(items.map(item => [item.slug, item._id]));
    const recipeOps = recipeDocuments
        .filter(value => idsBySlug.has(value.result)
            && (value.shapelessIngredients.length
                ? value.shapelessIngredients.flat().every(slug => idsBySlug.has(slug))
                : value.pattern.filter(Boolean).every(slug => idsBySlug.has(slug))))
        .map(value => ({
            updateOne: {
                filter: { recipeKey: value.recipeKey },
                update: {
                    $set: {
                        station: "workbench",
                        shapeless: value.shapelessIngredients.length > 0,
                        ingredients: value.shapelessIngredients.map(group => ({ itemIds: group.map(slug => idsBySlug.get(slug)), quantity: 1 })),
                        pattern: value.pattern.map((slug, index) => slug ? {
                            itemId: idsBySlug.get(slug),
                            itemIds: value.slotGroups[index].map(value => idsBySlug.get(value)),
                            quantity: 1,
                        } : {}),
                        result: { itemId: idsBySlug.get(value.result), quantity: value.quantity },
                    },
                },
                upsert: true,
            },
        }));
    if (recipeOps.length) await Recipe.bulkWrite(recipeOps, { ordered: false });
    const staleKeys = [
        "oak_plank_from_log", "sticks_from_planks", "coal_from_coal_block", "iron_ingots_from_block",
        "iron_ingots_from_raw_iron", "smooth_stone_from_stone", "wooden_pickaxe", "wooden_axe",
        "wooden_shovel", "wooden_sword", "stone_pickaxe", "stone_axe", "stone_shovel", "stone_sword",
        "iron_pickaxe", "iron_axe", "iron_shovel", "iron_sword", "iron_helmet", "iron_chestplate",
        "iron_leggings", "iron_boots", "iron_block", "coal_block",
    ];
    await Recipe.deleteMany({ recipeKey: { $in: staleKeys } });

    await fs.mkdir(iconDirectory, { recursive: true });
    let copiedIcons = 0;
    const missingIcons = [];
    for (const item of additions) {
        const source = jarEntries.get(item.__iconSource);
        if (source) {
            await fs.writeFile(path.join(iconDirectory, `${item.slug}.png`), source);
            copiedIcons += 1;
        } else missingIcons.push(item.slug);
    }
    console.log(`Added missing items (database upserted): ${newItems.length}; recipes synchronized: ${recipeOps.length}; icons copied: ${copiedIcons}; icons unavailable: ${missingIcons.length}.`);
    await mongoose.disconnect();
}

main().catch(async error => {
    console.error("Could not import Minecraft catalog:", error.message);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exitCode = 1;
});
