import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import Item from "../models/Item.model.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const itemsDir = path.resolve(scriptDir, "../assets/items");
const supportedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
// oak_plank has no dedicated asset yet; oak_log is the closest available image.
const imageAliases = new Map([["oak_plank", "oak_log"]]);
const applyChanges = process.argv.includes("--apply");

function iconPathFor(filename) {
    return `/items/${filename}`;
}

async function main() {
    if (!process.env.DB_URL) {
        throw new Error("DB_URL is missing. Add it to server/.env before running this script.");
    }

    const filenames = (await fs.readdir(itemsDir, { withFileTypes: true }))
        .filter(entry => entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase()))
        .map(entry => entry.name);
    const filenamesBySlug = new Map(
        filenames.map(filename => [path.parse(filename).name.toLowerCase(), filename])
    );

    await mongoose.connect(process.env.DB_URL);
    const items = await Item.find({}, "slug name icon").lean();
    const updates = [];
    const missingFiles = [];
    const usedFiles = new Set();

    for (const item of items) {
        const filename = filenamesBySlug.get(item.slug.toLowerCase())
            ?? filenamesBySlug.get(imageAliases.get(item.slug.toLowerCase()));

        if (!filename) {
            missingFiles.push({ slug: item.slug, name: item.name, currentIcon: item.icon || null });
            continue;
        }

        usedFiles.add(filename);
        const expectedIcon = iconPathFor(filename);
        if (item.icon !== expectedIcon) {
            updates.push({ item, icon: expectedIcon });
        }
    }

    const filesWithoutItems = filenames.filter(
        filename => !items.some(item => item.slug.toLowerCase() === path.parse(filename).name.toLowerCase())
    );

    console.log(`Mode: ${applyChanges ? "APPLY" : "DRY RUN"}`);
    console.log(`Items in database: ${items.length}`);
    console.log(`Image files found: ${filenames.length}`);
    console.log(`Icons to add/fix: ${updates.length}`);
    for (const { item, icon } of updates) {
        console.log(`  ${item.slug}: ${item.icon || "<empty>"} -> ${icon}`);
    }

    console.log(`Items without a matching image: ${missingFiles.length}`);
    for (const item of missingFiles) {
        console.log(`  ${item.slug} (${item.name}) — current icon: ${item.currentIcon || "<empty>"}`);
    }

    console.log(`Image files without a matching item: ${filesWithoutItems.length}`);
    for (const filename of filesWithoutItems) console.log(`  ${filename}`);

    if (applyChanges && updates.length) {
        const operations = updates.map(({ item, icon }) => ({
            updateOne: {
                filter: { _id: item._id },
                update: { $set: { icon } },
            },
        }));
        const result = await Item.bulkWrite(operations);
        console.log(`Updated ${result.modifiedCount} item icon(s).`);
    } else if (!applyChanges) {
        console.log("No database writes performed. Re-run with --apply to save the listed changes.");
    } else {
        console.log("All matching item icons are already synchronized.");
    }

    await mongoose.disconnect();
}

main().catch(async error => {
    console.error("Could not sync item icons:", error.message);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exitCode = 1;
});
