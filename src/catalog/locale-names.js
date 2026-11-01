import { MOBS } from "../data/mobs.js";

const PREFIX = "minecraft:";
const POTION_PREFIX = "item.minecraft.potion.effect.";

const idsIn = (jar, folder) => jar.names
    .map(name => name.match(new RegExp(`^data/minecraft/${folder}/([^/]+)\\.json$`))?.[1])
    .filter(Boolean);

// Ключі локалізації Minecraft для всього, що гра показує назвою з файлу мови
export function collectNameKeys(jar) {
    const language = jar.json("assets/minecraft/lang/en_us.json");
    const slugs = jar.names.map(name => name.match(/^assets\/minecraft\/items\/([^/]+)\.json$/)?.[1]).filter(slug => slug && slug !== "air");

    const potions = Object.keys(language).filter(key => key.startsWith(POTION_PREFIX));
    const banners = idsIn(jar, "banner_pattern").map(id => [id, `${jar.json(`data/minecraft/banner_pattern/${id}.json`).translation_key.replace(PREFIX, "")}.white`]);

    return {
        items: slugs.map(slug => [slug, language[`item.minecraft.${slug}`] ? `item.minecraft.${slug}` : `block.minecraft.${slug}`]),
        enchantments: idsIn(jar, "enchantment").map(id => [id, `enchantment.minecraft.${id}`]),
        potions: potions.map(key => [key.slice(POTION_PREFIX.length), key]),
        trimMaterials: idsIn(jar, "trim_material").map(id => [id, `trim_material.minecraft.${id}`]),
        trimPatterns: idsIn(jar, "trim_pattern").map(id => [id, `trim_pattern.minecraft.${id}`]),
        banners,
        mobs: MOBS.map(({ slug }) => [slug, `entity.minecraft.${slug}`]),
    };
}
