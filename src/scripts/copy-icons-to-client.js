import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Іконки їдуть разом із сайтом: безплатний ngrok відповідає на запит картинки з браузера сторінкою попередження.
// Запускати після render:icons, sync:item-icons або export:assets.
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(scriptDir, "../assets/items");
const target = path.resolve(scriptDir, "../../../client/public/items");

await fs.rm(target, { recursive: true, force: true });
await fs.cp(source, target, { recursive: true });

const files = await fs.readdir(target, { recursive: true, withFileTypes: true });
console.log(`Copied ${files.filter(entry => entry.isFile()).length} icons to client/public/items`);
