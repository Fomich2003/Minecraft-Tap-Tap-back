// Щоденна скриня: по кілька предметів зі списку, який росте разом із глибиною, де вже бував гравець
const POOLS = [
    [["bread", 4, 8], ["cooked_chicken", 2, 4], ["coal", 8, 16], ["oak_log", 16, 32], ["apple", 2, 4]],
    [["cooked_beef", 2, 4], ["iron_ingot", 3, 6], ["experience_bottle", 2, 4], ["lapis_lazuli", 4, 8]],
    [["gold_ingot", 3, 6], ["golden_carrot", 2, 4], ["diamond", 1, 2], ["experience_bottle", 4, 8]],
    [["golden_apple", 1, 2], ["blaze_rod", 2, 4], ["ender_pearl", 1, 3], ["diamond", 2, 3]],
    [["netherite_scrap", 1, 1], ["shulker_shell", 1, 2], ["experience_bottle", 8, 16], ["enchanted_golden_apple", 1, 1]],
];

const ROLLS = 3;
const LEVELS_PER_POOL = 15;

const pick = list => list[Math.floor(Math.random() * list.length)];
const between = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// Однаковий предмет з двох кидків стає одним записом: інакше скриня показувала б його двічі
export function rollDailyLoot(xpLevel) {
    const unlocked = Math.min(POOLS.length, 1 + Math.floor(xpLevel / LEVELS_PER_POOL));
    const loot = new Map();
    for (let roll = 0; roll < ROLLS; roll += 1) {
        const [slug, min, max] = pick(POOLS[Math.floor(Math.random() * unlocked)]);
        loot.set(slug, (loot.get(slug) ?? 0) + between(min, max));
    }
    return [...loot].map(([slug, quantity]) => ({ slug, quantity }));
}
