import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import GameData from "../models/GameData.model.js";
import Inventory from "../models/Inventory.model.js";
import Item from "../models/Item.model.js";
import Recipe from "../models/Recipe.model.js";
import Station from "../models/Station.model.js";
import User from "../models/User.model.js";
import { buildCatalog } from "../catalog/build-catalog.js";
import { openJar } from "../catalog/jar.js";
import { prepareMinecraftData } from "../catalog/source.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const version = process.env.MINECRAFT_VERSION || "26.3";
const dryRun = process.argv.includes("--dry-run");

// Предмети, яких більше немає в грі, переносяться у своїх власників
const REPLACED_ITEMS = { oak_plank: "oak_planks", chain: "iron_chain" };

// Старий індекс був sparse: рецепти без ключа більше не існують
async function dropLegacyRecipeIndex() {
    const collection = mongoose.connection.db.collection("recipes");
    const indexes = await collection.indexes().catch(() => []);
    if (indexes.some(index => index.name === "recipeKey_1" && index.sparse)) await collection.dropIndex("recipeKey_1");
}

async function replaceItems() {
    for (const [oldSlug, newSlug] of Object.entries(REPLACED_ITEMS)) {
        const [oldItem, newItem] = await Promise.all([Item.findOne({ slug: oldSlug }), Item.findOne({ slug: newSlug })]);
        if (!oldItem) continue;
        if (newItem) {
            await Inventory.updateMany({ "items.itemId": oldItem._id }, { $set: { "items.$[stack].itemId": newItem._id } }, { arrayFilters: [{ "stack.itemId": oldItem._id }] });
            await User.updateMany({ tapBlocks: oldItem._id }, { $addToSet: { tapBlocks: newItem._id } });
            await User.updateMany({ tapBlocks: oldItem._id }, { $pull: { tapBlocks: oldItem._id } });
        }
        await Item.deleteOne({ _id: oldItem._id });
        console.log(`Replaced ${oldSlug} with ${newSlug}`);
    }
}

async function applyCatalog(catalog) {
    await Item.bulkWrite(catalog.items.map(item => ({
        updateOne: { filter: { slug: item.slug }, update: { $set: item }, upsert: true },
    })), { ordered: false });

    await replaceItems();
    await Item.deleteMany({ slug: "air" });

    const ids = new Map((await Item.find({}, "slug").lean()).map(item => [item.slug, item._id]));
    await Item.updateMany({}, { $set: { canTap: false, isFirst: false, price: 0, canDrop: [] } });
    await Item.bulkWrite(catalog.tapBlocks.map(block => ({
        updateOne: {
            filter: { slug: block.slug },
            update: {
                $set: {
                    canTap: true, isFirst: block.isFirst, price: block.price, tapsToBreak: block.tapsToBreak,
                    canDrop: block.drops.map(([slug, chance]) => ({ itemId: ids.get(slug), chance })),
                },
            },
        },
    })));

    await Recipe.deleteMany({});
    await Recipe.insertMany(catalog.recipes, { ordered: false });

    await Station.deleteMany({ slug: { $nin: catalog.stations.map(station => station.slug) } });
    await Station.bulkWrite(catalog.stations.map(station => ({
        updateOne: { filter: { slug: station.slug }, update: { $set: station }, upsert: true },
    })));

    await GameData.bulkWrite(Object.entries(catalog.gameData).map(([key, value]) => ({
        updateOne: { filter: { key }, update: { $set: { value } }, upsert: true },
    })));

    // Інвентарі зі старою схемою отримують порожній ключ стака
    await Inventory.updateMany({ "items.stackKey": { $exists: false } }, { $set: { "items.$[stack].stackKey": "" } }, { arrayFilters: [{ "stack.stackKey": { $exists: false } }] });
}

async function main() {
    const { jarPath, ukrainian } = await prepareMinecraftData(version);
    const properties = JSON.parse(await fs.readFile(path.join(scriptDir, "../data/minecraft-26.1-properties.json"), "utf8"));
    const catalog = buildCatalog({ jar: openJar(jarPath), ukrainian, properties });

    const kinds = {};
    for (const recipe of catalog.recipes) kinds[recipe.kind] = (kinds[recipe.kind] ?? 0) + 1;
    console.log(`Minecraft version: ${version}`);
    console.log(`Items: ${catalog.items.length}, recipes: ${catalog.recipes.length}, skipped: ${catalog.skipped.length}`);
    console.log(`Recipe kinds: ${JSON.stringify(kinds)}`);
    console.log(`Stations: ${catalog.stations.length}, tap blocks: ${catalog.tapBlocks.length}, fuels: ${Object.keys(catalog.gameData.fuels).length}`);
    if (catalog.skipped.length) console.log(`Skipped: ${catalog.skipped.join(", ")}`);
    console.log(`Mode: ${dryRun ? "DRY RUN" : "APPLY"}`);
    if (dryRun) return;

    if (!process.env.DB_URL) throw new Error("DB_URL is missing. Add it to server/.env before running this script.");
    await mongoose.connect(process.env.DB_URL, { serverSelectionTimeoutMS: 15000 });
    await dropLegacyRecipeIndex();
    await Promise.all([Item.init(), Recipe.init(), Station.init(), GameData.init()]);
    await applyCatalog(catalog);
    console.log(`Imported. Items in database: ${await Item.countDocuments()}, recipes: ${await Recipe.countDocuments()}`);
    await mongoose.disconnect();
}

main().catch(async error => {
    console.error("Could not import Minecraft catalog:", error.message);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exitCode = 1;
});
