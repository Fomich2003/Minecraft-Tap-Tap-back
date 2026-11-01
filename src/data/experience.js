// Досвід: очки витрачаються на зачарування й ковадло, а рівень рахується від усього заробленого.
// Тому витрата очок ніколи не закриває вже відкриту локацію. Формула ванільна.
function xpForLevel(level) {
    if (level <= 16) return level * level + 6 * level;
    if (level <= 31) return Math.floor(2.5 * level * level - 40.5 * level + 360);
    return Math.floor(4.5 * level * level - 162.5 * level + 2220);
}

export function levelFromXp(total = 0) {
    let level = 0;
    while (xpForLevel(level + 1) <= total) level += 1;
    return level;
}

// Єдиний опис для клієнта: він нічого не рахує сам
export function describeXp(user) {
    const total = user.xpTotal ?? 0;
    const level = levelFromXp(total);
    const floor = xpForLevel(level);
    return { points: user.xp ?? 0, total, level, current: total - floor, needed: xpForLevel(level + 1) - floor };
}

// Досвід за видобутий блок: як в оригіналі, лише руди
const ORE_XP = {
    coal_ore: 1, copper_ore: 1, nether_gold_ore: 1, iron_ore: 2, redstone_ore: 2, nether_quartz_ore: 2,
    gold_ore: 3, lapis_ore: 3, amethyst_block: 2, glowstone: 2, diamond_ore: 7, emerald_ore: 7, ancient_debris: 10,
};

export const blockXp = slug => ORE_XP[slug] ?? 0;

// Вартість у ванільних рівнях переводиться в очки
export const ENCHANT_XP_PER_LEVEL = 5;
export const ANVIL_XP_PER_LEVEL = 3;

export const XP_BOTTLE_POINTS = 7;

// Переробка: 200 монет ціни дають 1 очко. Дрібний предмет дає шанс на очко, тому корисний будь-який
const RECYCLE_COINS_PER_XP = 200;

export function recycleXp(marketPrice, quantity, random = Math.random()) {
    const value = marketPrice * quantity / RECYCLE_COINS_PER_XP;
    return Math.floor(value) + (random < value % 1 ? 1 : 0);
}
