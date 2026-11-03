import { levelFromXp } from "../../data/experience.js";
import { MAX_MAP_SCALE } from "../../data/expeditions.js";
import { LOCATIONS } from "../../data/locations.js";

const TRIM_MATERIALS = {
    amethyst_shard: "amethyst", copper_ingot: "copper", diamond: "diamond", emerald: "emerald", gold_ingot: "gold",
    iron_ingot: "iron", lapis_lazuli: "lapis", netherite_ingot: "netherite", quartz: "quartz", redstone: "redstone", resin_brick: "resin",
};

export const stonecutterStation = {
    repeatable: true,
    slots: () => ["input"],

    preview({ slots, catalog, options }) {
        const input = slots.input;
        if (!input) return null;
        const recipes = (catalog.recipesByStation.get("stonecutter") ?? []).filter(recipe => recipe.input.includes(input.slug));
        const choices = recipes.map(recipe => ({ recipeKey: recipe.recipeKey, result: recipe.result }));
        const selected = recipes.find(recipe => recipe.recipeKey === options?.recipeKey);
        if (!selected) return { choices };
        return { choices, recipeKey: selected.recipeKey, result: selected.result, consume: [{ cell: input, quantity: 1 }] };
    },
};

export const smithingStation = {
    slots: () => ["template", "base", "addition"],

    preview({ slots, catalog }) {
        const { template, base, addition } = slots;
        if (!base || !addition) return null;
        // Незеритове покращення обходиться без шаблона: лише оздоблення справді його потребують
        const recipe = (catalog.recipesByStation.get("smithing_table") ?? []).find(candidate =>
            (template ? candidate.template.includes(template.slug) : candidate.kind === "smithing_transform")
            && candidate.base.includes(base.slug) && candidate.addition.includes(addition.slug));
        if (!recipe) return null;

        const consume = [template, base, addition].filter(Boolean).map(cell => ({ cell, quantity: 1 }));
        if (recipe.kind === "smithing_transform") {
            return { recipeKey: recipe.recipeKey, consume, result: { slug: recipe.result.slug, quantity: recipe.result.quantity, components: base.components } };
        }
        const material = TRIM_MATERIALS[addition.slug];
        if (!material) return null;
        return {
            recipeKey: recipe.recipeKey,
            consume,
            result: { slug: base.slug, quantity: 1, components: { ...base.components, trim: { pattern: recipe.data.pattern, material } } },
        };
    },
};

export const loomStation = {
    slots: () => ["banner", "dye", "pattern"],

    preview({ slots, catalog, options }) {
        const { banner, dye, pattern } = slots;
        if (!banner || !banner.slug.endsWith("_banner") || !dye?.slug.endsWith("_dye")) return null;

        const { patterns, byItem } = catalog.game.bannerPatterns;
        const allowed = pattern ? (byItem[pattern.slug] ?? []) : Object.keys(patterns).filter(id => patterns[id].free);
        const choices = allowed.map(id => ({ id, name: patterns[id]?.name ?? id }));
        const existing = banner.components?.banner_patterns ?? [];
        if (existing.length >= 6 || !allowed.includes(options?.pattern)) return { choices };

        return {
            choices,
            result: {
                slug: banner.slug,
                quantity: 1,
                components: { ...banner.components, banner_patterns: [...existing, { pattern: options.pattern, color: dye.slug.replace(/_dye$/, "") }] },
            },
            consume: [{ cell: banner, quantity: 1 }, { cell: dye, quantity: 1 }],
        };
    },
};

// Номер мапи з її змісту: попередній перегляд і створення дають ту саму мапу, а копії лишаються копіями
function mapId(userId, location) {
    let hash = 2166136261;
    for (const char of `${userId}:${location}:${Math.floor(Date.now() / 65536)}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    return hash & 0x7fffffff;
}

// Мапа креслиться для відкритої локації: саме з неї розвідник принесе здобич
function locationChoices(user) {
    const level = levelFromXp(user?.xpTotal ?? 0);
    return LOCATIONS.map(location => ({ id: location.id, level: location.level, open: level >= location.level }));
}

export const cartographyStation = {
    slots: () => ["map", "addition"],

    preview({ slots, user, options }) {
        const { map, addition } = slots;
        if (!map) return null;

        const charting = !addition && (map.slug === "map" || (map.slug === "filled_map" && !map.components?.map_location));
        if (charting) {
            const choices = locationChoices(user);
            const chosen = choices.find(choice => choice.id === options?.location && choice.open);
            if (!chosen) return { choices };
            const components = { ...map.components, map_id: map.components?.map_id ?? mapId(user?._id, chosen.id), map_scale: map.components?.map_scale ?? 0, map_location: chosen.id };
            return { choices, result: { slug: "filled_map", quantity: 1, components }, consume: [{ cell: map, quantity: 1 }] };
        }
        if (map.slug !== "filled_map" || !addition) return null;

        const consume = [{ cell: map, quantity: 1 }, { cell: addition, quantity: 1 }];
        if (addition.slug === "map") return { result: { slug: map.slug, quantity: 2, components: map.components }, consume };
        if (addition.slug === "glass_pane" && !map.components?.map_locked) {
            return { result: { slug: map.slug, quantity: 1, components: { ...map.components, map_locked: true } }, consume };
        }
        const scale = map.components?.map_scale ?? 0;
        if (addition.slug === "paper" && scale < MAX_MAP_SCALE && !map.components?.map_locked) {
            return { result: { slug: map.slug, quantity: 1, components: { ...map.components, map_scale: scale + 1 } }, consume };
        }
        return null;
    },
};
