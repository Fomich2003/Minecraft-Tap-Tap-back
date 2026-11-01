// Глобальне покращення тапа: скидає монети, але діє на всі блоки одразу.
// Ціна зростає разом із доходом, тому кожен наступний рівень займає більше часу.
const BASE_COINS_PER_TAP = 1;
const COINS_PER_LEVEL = 1;
const BASE_COST = 1000;
const COST_GROWTH = 1.6;
const AWARD_PER_LEVEL = 500;

export function coinsPerTap(level = 0) {
    return BASE_COINS_PER_TAP + level * COINS_PER_LEVEL;
}

export function upgradeCost(level = 0) {
    return Math.round(BASE_COST * COST_GROWTH ** level / 10) * 10;
}

// Щоденна нагорода росте разом із доходом, інакше після кількох рівнів вона нічого не варта
export function dailyAward(level = 0) {
    return AWARD_PER_LEVEL * (1 + level);
}

// Єдиний опис рівня для клієнта: він нічого не рахує сам
export function describeUpgrade(level = 0) {
    return {
        level,
        coinsPerTap: coinsPerTap(level),
        nextCoinsPerTap: coinsPerTap(level + 1),
        cost: upgradeCost(level),
    };
}
