import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cacheRoot = path.resolve(scriptDir, "../../temp/minecraft");
const MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

async function fetchBuffer(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
    return Buffer.from(await response.arrayBuffer());
}

async function cached(filePath, sha1, url) {
    const existing = await fs.readFile(filePath).catch(() => null);
    const hash = data => crypto.createHash("sha1").update(data).digest("hex");
    if (existing && (!sha1 || hash(existing) === sha1)) return existing;
    const data = await fetchBuffer(url);
    if (sha1 && hash(data) !== sha1) throw new Error(`Checksum mismatch: ${url}`);
    await fs.writeFile(filePath, data);
    return data;
}

// Будь-яка мова гри. Індекс ресурсів уже лежить поруч після prepareMinecraftData
export async function downloadLanguage(version, file) {
    const directory = path.join(cacheRoot, version);
    const assetIndex = JSON.parse(await fs.readFile(path.join(directory, "assets.json"), "utf8"));
    const language = assetIndex.objects[`minecraft/lang/${file}.json`];
    if (!language) return null;
    await fs.mkdir(path.join(directory, "lang"), { recursive: true });
    const url = `https://resources.download.minecraft.net/${language.hash.slice(0, 2)}/${language.hash}`;
    return JSON.parse((await cached(path.join(directory, "lang", `${file}.json`), language.hash, url)).toString("utf8"));
}

// Завантажує клієнт гри як архів даних і українську локалізацію в server/temp
export async function prepareMinecraftData(version) {
    const directory = path.join(cacheRoot, version);
    await fs.mkdir(directory, { recursive: true });

    const metaPath = path.join(directory, "version.json");
    let meta = await fs.readFile(metaPath, "utf8").then(JSON.parse).catch(() => null);
    if (!meta) {
        const manifest = JSON.parse((await fetchBuffer(MANIFEST_URL)).toString("utf8"));
        const entry = manifest.versions.find(value => value.id === version);
        if (!entry) throw new Error(`Unknown Minecraft version: ${version}`);
        meta = JSON.parse((await cached(metaPath, entry.sha1, entry.url)).toString("utf8"));
    }

    const jarPath = path.join(directory, "client.jar");
    await cached(jarPath, meta.downloads.client.sha1, meta.downloads.client.url);

    const assetIndex = JSON.parse((await cached(path.join(directory, "assets.json"), meta.assetIndex.sha1, meta.assetIndex.url)).toString("utf8"));
    const language = assetIndex.objects["minecraft/lang/uk_ua.json"];
    const languageUrl = `https://resources.download.minecraft.net/${language.hash.slice(0, 2)}/${language.hash}`;
    const ukrainian = JSON.parse((await cached(path.join(directory, "uk_ua.json"), language.hash, languageUrl)).toString("utf8"));

    return { jarPath, ukrainian };
}
