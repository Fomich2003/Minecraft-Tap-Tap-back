// Лічильники квестів. Частина рахується подіями гри, а level, blocks і stations читаються зі стану гравця.
// tier визначає складність: щодня гравець отримує по одному квесту кожного рівня.
const quest = (id, tier, metric, target, coins, items = [], requires = null) => ({ id, tier, metric, target, coins, items, requires });

export const DAILY_TIERS = [0, 1, 2];

// coins множаться на рівень покращення: дохід росте, і нагорода не має знецінюватись
export const DAILY_QUESTS = [
    quest("daily_taps_easy", 0, "taps", 200, 150),
    quest("daily_broken_easy", 0, "broken", 15, 150),
    quest("daily_drops_easy", 0, "drops", 10, 150),
    quest("daily_award", 0, "awards", 1, 100),
    quest("daily_consume", 0, "consumed", 1, 150),
    quest("daily_kills_easy", 0, "kills", 10, 200),

    quest("daily_taps_medium", 1, "taps", 800, 400),
    quest("daily_broken_medium", 1, "broken", 60, 400),
    quest("daily_crafts", 1, "crafts", 16, 400),
    quest("daily_sold", 1, "sold", 32, 300),
    quest("daily_bought", 1, "bought", 16, 300),
    quest("daily_cooked", 1, "cooked", 8, 450, [], "cooking"),
    quest("daily_kills_medium", 1, "kills", 40, 500),

    quest("daily_taps_hard", 2, "taps", 2500, 1000, [{ slug: "iron_ingot", quantity: 4 }]),
    quest("daily_drops_hard", 2, "drops", 100, 1000, [{ slug: "gold_ingot", quantity: 2 }]),
    quest("daily_coins", 2, "coins", 3000, 800, [{ slug: "emerald", quantity: 1 }]),
    quest("daily_ores", 2, "ores", 30, 1200, [{ slug: "diamond", quantity: 1 }]),
    quest("daily_brewed", 2, "brewed", 3, 1200, [{ slug: "golden_apple", quantity: 1 }], "brewing"),
];

// Ланцюжок постійних квестів одного лічильника: [ціль, монети, предмети]
const chain = (metric, steps) => steps.map(([target, coins, items = []]) => quest(`${metric}_${target}`, null, metric, target, coins, items));

const stack = (slug, quantity = 1) => [{ slug, quantity }];

export const PERMANENT_QUESTS = [
    ...chain("taps", [[100, 200], [1000, 1000, stack("coal", 16)], [10000, 5000, stack("diamond", 3)], [100000, 50000, stack("netherite_ingot")]]),
    ...chain("kills", [[25, 500], [250, 3000, stack("iron_sword")], [2500, 20000, stack("diamond_sword")]]),
    ...chain("bosses", [[1, 5000, stack("golden_apple", 2)], [10, 30000, stack("beacon")], [50, 150000, stack("netherite_ingot", 2)]]),
    ...chain("broken", [[50, 300], [500, 2000, stack("iron_pickaxe")], [5000, 15000, stack("diamond_pickaxe")]]),
    ...chain("drops", [[100, 500], [1000, 3000, stack("golden_apple", 2)], [10000, 25000, stack("enchanted_golden_apple")]]),
    ...chain("ores", [[50, 1000, stack("iron_ingot", 8)], [500, 8000, stack("diamond", 5)]]),
    ...chain("coins", [[10000, 1000], [100000, 10000, stack("emerald", 8)], [1000000, 100000, stack("nether_star")]]),
    ...chain("crafts", [[10, 300], [100, 2000, stack("gold_ingot", 8)], [1000, 15000, stack("diamond", 8)]]),
    ...chain("cooked", [[16, 500], [256, 5000, stack("blaze_powder", 8)]]),
    ...chain("brewed", [[3, 1000, stack("golden_apple")], [30, 8000, stack("totem_of_undying")]]),
    ...chain("sold", [[64, 500], [1024, 5000]]),
    ...chain("bought", [[32, 500], [512, 5000]]),
    ...chain("consumed", [[5, 500], [50, 5000, stack("experience_bottle", 16)]]),
    ...chain("awards", [[7, 1500], [30, 8000, stack("elytra")]]),
    ...chain("dailies", [[7, 2000, stack("lapis_lazuli", 16)], [30, 10000, stack("diamond", 5)], [100, 40000, stack("beacon")]]),
    ...chain("level", [[1, 500], [3, 3000, stack("iron_ingot", 16)], [5, 10000, stack("diamond", 4)], [10, 100000, stack("netherite_ingot", 2)]]),
    ...chain("blocks", [[3, 300], [10, 3000], [20, 15000, stack("emerald", 16)], [29, 80000, stack("nether_star")]]),
    ...chain("stations", [[3, 1500], [7, 6000], [12, 30000, stack("diamond", 16)]]),
];

export const dailyCoins = (quest, level) => quest.coins * (1 + level);

const DAILY_XP = [10, 25, 60];
const MIN_QUEST_XP = 10;
const COINS_PER_QUEST_XP = 50;

export const questXp = quest => (quest.tier === null ? Math.max(MIN_QUEST_XP, Math.round(quest.coins / COINS_PER_QUEST_XP)) : DAILY_XP[quest.tier]);
