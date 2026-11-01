// Моби, яких можна бити. Голими руками один тап знімає 1 здоров'я, тому hp більше ванільного:
// інакше курка окупалась би краще за будь-який блок, а меч не мав би сенсу.
// Ворожі моби продаються гірше за тварин, зате дають сировину для зілль і чарів, тому й відкриваються дешевше.
// Дроп: [предмет, мінімум, максимум, шанс]. Кожен запис перевіряється окремо, тому моб може нічого не дати.
const mob = (slug, name, price, hp, drops) => ({ slug, name, price, hp, drops, xp: Math.ceil(hp / 4), icon: `/items/${slug}_spawn_egg.png` });

// Бос призивається раз на cooldownHours і втікає за minutes. Здоров'я вимагає меча: голими руками встигнути неможливо.
// Боси живуть у своїх локаціях, тому раніше цієї глибини їхня нагорода не може зламати економіку.
const boss = (slug, name, hp, xp, settings) => ({ ...mob(slug, name, 0, hp, []), xp, boss: settings });

export const MOBS = [
    mob("chicken", "Курка", 0, 12, [["chicken", 1, 1, .8], ["feather", 1, 2, .6]]),
    mob("cow", "Корова", 300, 30, [["beef", 1, 2, .8], ["leather", 1, 1, .6]]),
    mob("pig", "Свиня", 300, 30, [["porkchop", 1, 3, .9]]),
    mob("sheep", "Вівця", 500, 24, [["mutton", 1, 2, .8], ["white_wool", 1, 1, .6]]),
    mob("rabbit", "Кролик", 800, 9, [["rabbit", 1, 1, .7], ["rabbit_hide", 1, 1, .5], ["rabbit_foot", 1, 1, .05]]),
    mob("cod", "Тріска", 1000, 9, [["cod", 1, 1, .8], ["bone_meal", 1, 1, .05]]),
    mob("salmon", "Лосось", 1200, 9, [["salmon", 1, 1, .8], ["bone_meal", 1, 1, .05]]),
    mob("zombie", "Зомбі", 1500, 40, [["rotten_flesh", 1, 2, .8], ["iron_ingot", 1, 1, .05], ["carrot", 1, 1, .05], ["potato", 1, 1, .05]]),
    mob("skeleton", "Скелет", 2000, 40, [["bone", 1, 2, .8], ["arrow", 1, 2, .7]]),
    mob("spider", "Павук", 2500, 32, [["string", 1, 2, .8], ["spider_eye", 1, 1, .3]]),
    mob("creeper", "Кріпер", 3000, 40, [["gunpowder", 1, 2, .7]]),
    mob("witch", "Відьма", 5000, 52, [["redstone", 1, 2, .3], ["glowstone_dust", 1, 2, .3], ["sugar", 1, 2, .3], ["glass_bottle", 1, 1, .3]]),
    mob("enderman", "Ендермен", 10000, 80, [["ender_pearl", 1, 1, .5]]),
    mob("blaze", "Пломінь", 15000, 40, [["blaze_rod", 1, 1, .5]]),
    mob("slime", "Слимак", 1800, 32, [["slime_ball", 1, 2, .7]]),
    mob("drowned", "Потопельник", 2200, 40, [["rotten_flesh", 1, 2, .7], ["copper_ingot", 1, 1, .1], ["nautilus_shell", 1, 1, .03]]),
    mob("phantom", "Фантом", 6000, 40, [["phantom_membrane", 1, 2, .5]]),
    mob("guardian", "Вартовий", 8000, 60, [["prismarine_shard", 1, 2, .7], ["prismarine_crystals", 1, 1, .3], ["cod", 1, 1, .5]]),
    mob("piglin", "Піґлін", 12000, 32, [["gold_nugget", 1, 3, .7], ["gold_ingot", 1, 1, .1]]),
    mob("hoglin", "Гоґлін", 14000, 80, [["porkchop", 2, 4, .9], ["leather", 1, 2, .5]]),
    mob("magma_cube", "Магмокуб", 16000, 32, [["magma_cream", 1, 1, .5]]),
    mob("ghast", "Ґаст", 20000, 20, [["ghast_tear", 1, 1, .3], ["gunpowder", 1, 2, .6]]),
    mob("wither_skeleton", "Візер-скелет", 25000, 40, [["coal", 1, 1, .4], ["bone", 1, 2, .6], ["wither_skeleton_skull", 1, 1, .05]]),
    mob("shulker", "Шалкер", 40000, 60, [["shulker_shell", 1, 1, .4]]),
    boss("wither", "Візер", 4000, 500, {
        cooldownHours: 24, minutes: 5, coins: 1000,
        loot: [["nether_star", 1, 1, 1], ["experience_bottle", 4, 8, 1]],
    }),
    boss("ender_dragon", "Дракон Енду", 12000, 1500, {
        cooldownHours: 72, minutes: 10, coins: 3000,
        loot: [["dragon_egg", 1, 1, 1], ["dragon_breath", 2, 4, 1], ["experience_bottle", 8, 16, 1], ["elytra", 1, 1, .25]],
    }),
];

export const mobBySlug = new Map(MOBS.map(entry => [entry.slug, entry]));

const STRENGTH_DAMAGE = 3;
const SHARPNESS_DAMAGE = 1;
const LOOTING_CHANCE = .1;

// Прогрес моба лежить поруч із прогресом блоків, тому отримує власний префікс
export const mobProgressKey = slug => `mob_${slug}`;

export const swordDamage = (basePower, enchantments = {}) => basePower + (enchantments.sharpness ?? 0) * SHARPNESS_DAMAGE;

export const swordDropBonus = (enchantments = {}) => (enchantments.looting ?? 0) * LOOTING_CHANCE;

export function mobDamage(sword, effects) {
    const strength = effects.find(effect => effect.id === "strength")?.level ?? 0;
    return (sword?.power ?? 1) + strength * STRENGTH_DAMAGE;
}
