import { isNetherBlock, isOreBlock } from "./tools.js";

// Ефекти Minecraft і те, що вони дають у тапанні. Час іде реальний, як у зіллях оригіналу.
const POTION_EFFECTS = {
    strength: "strength",
    swiftness: "speed",
    luck: "luck",
    regeneration: "regeneration",
    night_vision: "night_vision",
    fire_resistance: "fire_resistance",
};

const POTION_FORMS = new Set(["potion", "splash_potion", "lingering_potion"]);
const BASE_SECONDS = 180;
const LONG_SECONDS = 480;
const STRONG_SECONDS = 90;
const SECONDS_PER_FOOD_POINT = 10;

// Особливі страви працюють як у грі: дорожчі за зілля, зате дають кілька ефектів одразу
const SPECIAL_FOOD = {
    golden_apple: [{ id: "regeneration", level: 2, seconds: 120 }, { id: "strength", level: 1, seconds: 120 }],
    enchanted_golden_apple: [
        { id: "regeneration", level: 2, seconds: 300 },
        { id: "strength", level: 2, seconds: 300 },
        { id: "fire_resistance", level: 1, seconds: 300 },
        { id: "luck", level: 1, seconds: 300 },
    ],
};

const eaten = (id, seconds, level = 1) => ({ id, level, seconds });

// Будь-яка їжа дає насичення, а приготована ще й свій ефект: так смаження варте часу
const FOOD_BONUS = {
    cooked_beef: eaten("strength", 60), cooked_porkchop: eaten("strength", 60),
    cooked_mutton: eaten("speed", 60), cooked_chicken: eaten("speed", 45), cookie: eaten("speed", 20),
    cooked_cod: eaten("night_vision", 60), cooked_salmon: eaten("night_vision", 75), golden_carrot: eaten("night_vision", 120),
    cooked_rabbit: eaten("luck", 60), rabbit_stew: eaten("luck", 90, 2), pumpkin_pie: eaten("luck", 90),
    baked_potato: eaten("fire_resistance", 60),
    apple: eaten("regeneration", 20), honey_bottle: eaten("regeneration", 30), mushroom_stew: eaten("regeneration", 45), beetroot_soup: eaten("regeneration", 45),
};

const CONTAINERS = {
    potion: "glass_bottle",
    honey_bottle: "glass_bottle",
    mushroom_stew: "bowl",
    beetroot_soup: "bowl",
    rabbit_stew: "bowl",
    suspicious_stew: "bowl",
};

const STRENGTH_COIN_BONUS = 0.3;
const SATURATION_COIN_BONUS = 0.15;
const LUCK_DROP_CHANCE = 0.2;

function potionEffects(potion = "") {
    const [, variant, base] = /^(long_|strong_)?(.+)$/.exec(potion) ?? [];
    const id = POTION_EFFECTS[base];
    if (!id) return [];
    if (variant === "strong_") return [{ id, level: 2, seconds: STRONG_SECONDS }];
    return [{ id, level: 1, seconds: variant === "long_" ? LONG_SECONDS : BASE_SECONDS }];
}

export function consumableEffects(item, components) {
    if (POTION_FORMS.has(item.slug)) return potionEffects(components?.potion);
    if (SPECIAL_FOOD[item.slug]) return SPECIAL_FOOD[item.slug];
    // Відра з рибою мають поживність у даних гри, але їжею не є
    if (!item.food?.nutrition || item.slug.endsWith("_bucket")) return [];
    const saturation = { id: "saturation", level: 1, seconds: item.food.nutrition * SECONDS_PER_FOOD_POINT };
    return FOOD_BONUS[item.slug] ? [saturation, FOOD_BONUS[item.slug]] : [saturation];
}

export const consumableContainer = slug => CONTAINERS[slug];

// Пляшечка досвіду не дає ефектів: вона одразу перетворюється на очки
export const isXpBottle = slug => slug === "experience_bottle";

export function activeEffects(user, now = Date.now()) {
    return (user.effects ?? [])
        .filter(effect => new Date(effect.expiresAt).getTime() > now)
        .map(({ id, level, expiresAt }) => ({ id, level, expiresAt: new Date(expiresAt) }));
}

// Як в оригіналі: сильніший ефект не перезаписується слабшим, поки діє
export function mergeEffects(current, gained, now = Date.now()) {
    const merged = new Map(current.map(effect => [effect.id, effect]));
    for (const { id, level, seconds } of gained) {
        const expiresAt = new Date(now + seconds * 1000);
        const existing = merged.get(id);
        if (existing?.level > level) continue;
        if (existing?.level === level && existing.expiresAt > expiresAt) continue;
        merged.set(id, { id, level, expiresAt });
    }
    return [...merged.values()];
}

const levelOf = (effects, id) => effects.find(effect => effect.id === id)?.level ?? 0;

// extra приходить від карт у колоді й додається до бонусу ефектів, а не множиться на нього
export function coinsWithEffects(baseCoins, effects, extra = 0) {
    const bonus = levelOf(effects, "strength") * STRENGTH_COIN_BONUS + (levelOf(effects, "saturation") ? SATURATION_COIN_BONUS : 0) + extra;
    return Math.ceil(baseCoins * (1 + bonus));
}

export function powerFromEffects(slug, effects) {
    const vision = isOreBlock(slug) && levelOf(effects, "night_vision") ? 1 : 0;
    const heat = isNetherBlock(slug) && levelOf(effects, "fire_resistance") ? 1 : 0;
    return levelOf(effects, "speed") + vision + heat;
}

export const luckyDropChance = effects => levelOf(effects, "luck") * LUCK_DROP_CHANCE;

export const toolRepairPerDrop = effects => levelOf(effects, "regeneration");
