import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import Item from "../models/Item.model.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(scriptDir, "../..");

async function main() {
    if (!process.env.DB_URL) throw new Error("DB_URL is missing from server/.env");

    await mongoose.connect(process.env.DB_URL);
    const items = await Item.find({}, "slug name icon").lean();
    const results = await Promise.all(items.map(async item => {
        const icon = String(item.icon || "").replace(/^\/+/, "");
        const filePath = icon.startsWith("items/")
            ? path.join(serverDir, "src", "assets", icon)
            : null;

        let exists = false;
        if (filePath) {
            try {
                exists = (await fs.stat(filePath)).isFile();
            } catch {
                exists = false;
            }
        }

        return { slug: item.slug, icon: item.icon || null, fileExists: exists };
    }));

    const missing = results.filter(result => !result.fileExists);
    console.log(JSON.stringify({
        totalItems: results.length,
        validIcons: results.length - missing.length,
        missingIcons: missing,
    }, null, 2));

    await mongoose.disconnect();
    if (missing.length) process.exitCode = 1;
}

main().catch(async error => {
    console.error("Could not verify item icons:", error.message);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exitCode = 1;
});
