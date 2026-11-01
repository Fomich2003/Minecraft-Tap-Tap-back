import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createIconRenderer } from "../catalog/icon-renderer.js";
import { openJar } from "../catalog/jar.js";
import { prepareMinecraftData } from "../catalog/source.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const iconDirectory = path.resolve(scriptDir, "../assets/items");
const version = process.env.MINECRAFT_VERSION || "26.3";

async function main() {
    const { jarPath } = await prepareMinecraftData(version);
    const jar = openJar(jarPath);
    const renderer = createIconRenderer(jar);
    const slugs = jar.names.map(name => name.match(/^assets\/minecraft\/items\/([^/]+)\.json$/)?.[1]).filter(Boolean).filter(slug => slug !== "air");

    const failed = [];
    for (const slug of slugs) {
        let icon = null;
        try {
            icon = renderer.render(slug);
        } catch (error) {
            console.error(`${slug}: ${error.message}`);
        }
        if (icon) await fs.writeFile(path.join(iconDirectory, `${slug}.png`), icon);
        else failed.push(slug);
    }

    const known = new Set(slugs);
    // Кольорові зілля лежать у власній папці, яку створює export-visual-assets
    for (const entry of await fs.readdir(iconDirectory, { withFileTypes: true })) {
        if (entry.isFile() && !known.has(path.parse(entry.name).name)) await fs.rm(path.join(iconDirectory, entry.name));
    }

    console.log(`Rendered ${slugs.length - failed.length} of ${slugs.length} icons`);
    if (failed.length) console.log(`Not rendered: ${failed.join(", ")}`);
}

main().catch(error => {
    console.error("Could not render item icons:", error.message);
    process.exitCode = 1;
});
