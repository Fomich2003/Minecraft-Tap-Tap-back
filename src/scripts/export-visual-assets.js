import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { openJar } from "../catalog/jar.js";
import { prepareMinecraftData } from "../catalog/source.js";

// Дістає з гри текстури для клієнта: візерунки банерів і плитки фону локацій
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const version = process.env.MINECRAFT_VERSION || "26.3";
const publicDir = path.resolve(scriptDir, "../../../client/public/assets");

// Лицьова сторона полотна в текстурі банера
const FACE = { x: 1, y: 1, width: 20, height: 40 };
const TILES = ["stone", "netherrack", "end_stone", "obsidian", "magma"];

// Порядок збігається зі списком NAMES у client/src/pages/Tap/worldMap.js. [ім'я або ім'я й файл, відтінок]
const GRASS_TINT = [124, 189, 107];
const LEAF_TINT = [96, 161, 66];
const WATER_TINT = [63, 118, 228];
const ATLAS = [
    ["grass_side", "grass_block_side"], "dirt", "stone", "andesite", "granite", "diorite", "gravel", "tuff",
    "coal_ore", "iron_ore", "copper_ore", "gold_ore", "lapis_ore",
    "deepslate", "deepslate_coal_ore", "deepslate_iron_ore", "deepslate_gold_ore", "deepslate_redstone_ore", "deepslate_lapis_ore", "deepslate_diamond_ore", "deepslate_emerald_ore",
    "amethyst_block", "amethyst_cluster", "sculk", "sculk_vein", "bedrock",
    "netherrack", "nether_quartz_ore", "nether_gold_ore", "glowstone", "magma", "soul_sand", ["basalt", "basalt_side"], "blackstone", "nether_bricks",
    "weeping_vines", "weeping_vines_plant", "crimson_fungus", "crimson_roots",
    "obsidian", "end_stone", "end_stone_bricks", "chorus_plant", "chorus_flower",
    "oak_log", ["oak_leaves", "oak_leaves", LEAF_TINT], "oak_planks", "torch", ["short_grass", "short_grass", GRASS_TINT], "dandelion", "poppy",
    ["water", "water_still", WATER_TINT], ["lava", "lava_still"],
    "moss_block", "dripstone_block", ["stalactite_tip", "pointed_dripstone_down_tip"], ["stalactite_base", "pointed_dripstone_down_frustum"],
    ["stalagmite_tip", "pointed_dripstone_up_tip"], ["stalagmite_base", "pointed_dripstone_up_frustum"],
    "cobweb", "brown_mushroom", "red_mushroom", "cave_vines", "cave_vines_plant",
];
const TILE = 16;

function tint(image, color) {
    for (let index = 0; index < image.data.length; index += 4) {
        for (let channel = 0; channel < 3; channel += 1) image.data[index + channel] = Math.round(image.data[index + channel] * color[channel] / 255);
    }
    return image;
}

function blockTexture(jar, file) {
    return PNG.sync.read(jar.read(`assets/minecraft/textures/block/${file}.png`));
}

function buildAtlas(jar) {
    const atlas = new PNG({ width: ATLAS.length * TILE, height: TILE });
    ATLAS.forEach((entry, column) => {
        const [name, file = name, color] = [entry].flat();
        const source = blockTexture(jar, file);
        // Анімовані текстури це стрічка кадрів: для карти досить першого
        PNG.bitblt(color ? tint(source, color) : source, atlas, 0, 0, TILE, TILE, column * TILE, 0);
    });
    return PNG.sync.write(atlas);
}

// Колір рідини з гри. Нейтральні зілля там однаково сині, тому мають власні відтінки: незграбне не сплутати з водою
const POTION_COLORS = {
    water: 0x385dc6, mundane: 0x8a93a6, thick: 0x3f8f8a, awkward: 0x7a4fc0,
    night_vision: 0xc2ff66, invisibility: 0xf6f6f6, leaping: 0xfdff84, fire_resistance: 0xff9900, swiftness: 0x33ebff, slowness: 0x8bafe0,
    turtle_master: 0x8e82e7, water_breathing: 0x98dac0, healing: 0xf82423, harming: 0xa9656a, poison: 0x87a363, regeneration: 0xcd5cab,
    strength: 0xffc700, weakness: 0x484d48, luck: 0x59c106, slow_falling: 0xffefd1, wind_charged: 0xbdc9ff, weaving: 0x78695a, oozing: 0x99ffa3, infested: 0x8c9b8c,
};
// Модель предмета в грі: нижній шар зафарбовується, верхній лежить поверх без змін
const TINTED_ITEMS = {
    potion: ["potion_overlay", "potion"],
    splash_potion: ["potion_overlay", "splash_potion"],
    lingering_potion: ["potion_overlay", "lingering_potion"],
    tipped_arrow: ["tipped_arrow_head", "tipped_arrow_base"],
};
const ICON_SCALE = 4;

const itemTexture = (jar, file) => PNG.sync.read(jar.read(`assets/minecraft/textures/item/${file}.png`));

function tintedIcon(jar, [tintedLayer, topLayer], color) {
    const under = tint(itemTexture(jar, tintedLayer), [color >> 16, (color >> 8) & 255, color & 255]);
    const over = itemTexture(jar, topLayer);
    const icon = new PNG({ width: under.width * ICON_SCALE, height: under.height * ICON_SCALE });
    for (let y = 0; y < icon.height; y += 1) {
        for (let x = 0; x < icon.width; x += 1) {
            const source = (Math.floor(y / ICON_SCALE) * under.width + Math.floor(x / ICON_SCALE)) * 4;
            const alpha = over.data[source + 3] / 255;
            const target = (y * icon.width + x) * 4;
            for (let channel = 0; channel < 3; channel += 1) {
                icon.data[target + channel] = Math.round(over.data[source + channel] * alpha + under.data[source + channel] * (1 - alpha));
            }
            icon.data[target + 3] = Math.round(over.data[source + 3] + under.data[source + 3] * (1 - alpha));
        }
    }
    return PNG.sync.write(icon);
}

async function exportPotionIcons(jar) {
    const directory = path.resolve(scriptDir, "../assets/items/potions");
    await fs.mkdir(directory, { recursive: true });
    for (const [slug, layers] of Object.entries(TINTED_ITEMS)) {
        for (const [potion, color] of Object.entries(POTION_COLORS)) {
            await fs.writeFile(path.join(directory, `${slug}_${potion}.png`), tintedIcon(jar, layers, color));
        }
    }
}

// Морда гаста з текстури моба: передня грань голови
function ghastFace(jar) {
    const source = PNG.sync.read(jar.read("assets/minecraft/textures/entity/ghast/ghast.png"));
    const face = new PNG({ width: 32, height: 32 });
    PNG.bitblt(source, face, 32, 32, 32, 32, 0, 0);
    return PNG.sync.write(face);
}

function cropFace(source) {
    const image = PNG.sync.read(source);
    const face = new PNG({ width: FACE.width, height: FACE.height });
    PNG.bitblt(image, face, FACE.x, FACE.y, FACE.width, FACE.height, 0, 0);
    return PNG.sync.write(face);
}

async function main() {
    const { jarPath } = await prepareMinecraftData(version);
    const jar = openJar(jarPath);
    await fs.mkdir(path.join(publicDir, "banners"), { recursive: true });

    const ids = jar.names.map(name => name.match(/^data\/minecraft\/banner_pattern\/([^/]+)\.json$/)?.[1]).filter(Boolean);
    for (const id of ids) {
        const asset = jar.json(`data/minecraft/banner_pattern/${id}.json`).asset_id.replace("minecraft:", "");
        await fs.writeFile(path.join(publicDir, "banners", `${id}.png`), cropFace(jar.read(`assets/minecraft/textures/entity/banner/${asset}.png`)));
    }
    for (const tile of TILES) {
        await fs.writeFile(path.join(publicDir, "tiles", `${tile}.png`), jar.read(`assets/minecraft/textures/block/${tile}.png`));
    }
    await fs.mkdir(path.join(publicDir, "world"), { recursive: true });
    await fs.writeFile(path.join(publicDir, "world", "atlas.png"), buildAtlas(jar));
    await fs.writeFile(path.join(publicDir, "tiles", "lava_strip.png"), jar.read("assets/minecraft/textures/block/lava_still.png"));
    await fs.writeFile(path.join(publicDir, "tiles", "lavafall_strip.png"), jar.read("assets/minecraft/textures/block/lava_flow.png"));
    await fs.writeFile(path.join(publicDir, "tiles", "water_strip.png"), PNG.sync.write(tint(blockTexture(jar, "water_flow"), WATER_TINT)));
    await fs.writeFile(path.join(publicDir, "world", "ghast.png"), ghastFace(jar));
    await exportPotionIcons(jar);
    console.log(`Exported ${ids.length} banner patterns, ${TILES.length} tiles, an atlas of ${ATLAS.length} and ${Object.keys(POTION_COLORS).length} potion colors`);
}

main().catch(error => {
    console.error("Could not export assets:", error.message);
    process.exitCode = 1;
});
