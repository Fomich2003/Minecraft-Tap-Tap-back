const COINS_PER_LEVEL = 100;

const enchantmentsOf = cell => cell.components?.stored_enchantments ?? cell.components?.enchantments ?? {};

function mergeEnchantments(left, right, targetSlug, enchantments) {
    const merged = { ...left };
    let cost = 0;
    const isBook = targetSlug === "enchanted_book";

    for (const [id, level] of Object.entries(right)) {
        const data = enchantments[id];
        if (!data) continue;
        if (!isBook && !data.supported.includes(targetSlug)) continue;
        if (Object.keys(merged).some(other => other !== id && (data.exclusive.includes(other) || enchantments[other]?.exclusive.includes(id)))) {
            cost += 1;
            continue;
        }
        const current = merged[id] ?? 0;
        const next = Math.min(data.maxLevel, current === level ? level + 1 : Math.max(current, level));
        merged[id] = next;
        cost += next * data.anvilCost;
    }
    return { merged, cost };
}

export const anvilStation = {
    slots: () => ["left", "right"],

    preview({ slots, catalog }) {
        const { left, right } = slots;
        if (!left || !right) return null;
        const item = catalog.itemBySlug.get(left.slug);
        const { enchantments } = catalog.game;
        const damage = left.components?.damage ?? 0;
        const max = item?.maxDurability ?? 0;

        if (max && item.repairWith?.includes(right.slug)) {
            if (!damage) return null;
            const perUnit = Math.max(1, Math.floor(max / 4));
            const units = Math.min(right.quantity, Math.ceil(damage / perUnit));
            return {
                coinCost: units * COINS_PER_LEVEL,
                result: { slug: left.slug, quantity: 1, components: { ...left.components, damage: Math.max(0, damage - units * perUnit) } },
                consume: [{ cell: left, quantity: 1 }, { cell: right, quantity: units }],
            };
        }

        const combinesBook = right.slug === "enchanted_book";
        if (!combinesBook && left.slug !== right.slug) return null;
        if (!combinesBook && !max) return null;

        const { merged, cost } = mergeEnchantments(enchantmentsOf(left), enchantmentsOf(right), left.slug, enchantments);
        const components = { ...left.components };
        let levels = cost;

        if (max && !combinesBook) {
            const remaining = (max - damage) + (max - (right.components?.damage ?? 0)) + Math.floor(max * 0.12);
            const nextDamage = Math.max(0, max - remaining);
            if (nextDamage < damage) levels += 2;
            components.damage = nextDamage;
        }
        if (!levels) return null;
        components[left.slug === "enchanted_book" ? "stored_enchantments" : "enchantments"] = merged;

        return {
            coinCost: levels * COINS_PER_LEVEL,
            result: { slug: left.slug, quantity: 1, components },
            consume: [{ cell: left, quantity: 1 }, { cell: right, quantity: 1 }],
        };
    },
};

export const grindstoneStation = {
    slots: () => ["top", "bottom"],

    preview({ slots, catalog }) {
        const { top, bottom } = slots;
        const parts = [top, bottom].filter(Boolean);
        if (!parts.length) return null;
        if (parts.length === 2 && top.slug !== bottom.slug) return null;

        const item = catalog.itemBySlug.get(parts[0].slug);
        const { enchantments } = catalog.game;
        const onlyCurses = list => Object.fromEntries(Object.entries(list ?? {}).filter(([id]) => enchantments[id]?.curse));
        const consume = parts.map(cell => ({ cell, quantity: 1 }));

        if (parts[0].slug === "enchanted_book") {
            if (parts.length !== 1) return null;
            const curses = onlyCurses(parts[0].components?.stored_enchantments);
            const hasCurses = Object.keys(curses).length > 0;
            return { consume, result: { slug: hasCurses ? "enchanted_book" : "book", quantity: 1, components: hasCurses ? { stored_enchantments: curses } : undefined } };
        }

        if (!item?.maxDurability) return null;
        const components = { ...parts[0].components };
        delete components.enchantments;
        const curses = parts.reduce((all, cell) => ({ ...all, ...onlyCurses(cell.components?.enchantments) }), {});
        if (Object.keys(curses).length) components.enchantments = curses;

        if (parts.length === 2) {
            const remaining = parts.reduce((sum, cell) => sum + item.maxDurability - (cell.components?.damage ?? 0), 0);
            components.damage = Math.max(0, item.maxDurability - remaining - Math.floor(item.maxDurability * 0.05));
        } else if (!parts[0].components?.enchantments) {
            return null;
        }
        return { consume, result: { slug: item.slug, quantity: 1, components } };
    },
};
