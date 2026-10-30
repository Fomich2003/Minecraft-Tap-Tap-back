import "dotenv/config";
import mongoose from "mongoose";

// Прибирає унікальні індекси, через які реєструвався лише один користувач:
// inventory_1 лишився від старої схеми, tapBlocks_1 робив кожен блок ексклюзивним,
// username_1 забороняв користувачів без Telegram username.
const OBSOLETE_INDEXES = ["inventory_1", "tapBlocks_1", "username_1"];
const applyChanges = process.argv.includes("--apply");

async function main() {
    if (!process.env.DB_URL) throw new Error("DB_URL is missing from server/.env");

    await mongoose.connect(process.env.DB_URL, { serverSelectionTimeoutMS: 15000 });
    const users = mongoose.connection.db.collection("users");
    const existing = (await users.indexes()).map(index => index.name);
    const toDrop = OBSOLETE_INDEXES.filter(name => existing.includes(name));

    console.log(`Mode: ${applyChanges ? "APPLY" : "DRY RUN"}`);
    console.log(`Indexes on users: ${existing.join(", ")}`);
    console.log(`Indexes to drop: ${toDrop.join(", ") || "none"}`);

    if (applyChanges) {
        for (const name of toDrop) await users.dropIndex(name);
        console.log(`Indexes on users now: ${(await users.indexes()).map(index => index.name).join(", ")}`);
    }

    await mongoose.disconnect();
}

main().catch(async error => {
    console.error("Could not migrate user indexes:", error.message);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exitCode = 1;
});
