import { CRAFTING_REMAINDERS } from "../../data/fuels.js";
import { matchSpecial, matchTransmute } from "./special-recipes.js";

// Шаблон можна зсувати в сітці й відзеркалювати, порожні клітинки навколо не враховуються
export function matchShaped(slugs, recipe) {
    const occupied = slugs.map((slug, index) => (slug ? index : -1)).filter(index => index >= 0);
    if (!occupied.length) return false;
    const rows = occupied.map(index => Math.floor(index / 3));
    const columns = occupied.map(index => index % 3);
    const top = Math.min(...rows);
    const left = Math.min(...columns);
    if (Math.max(...rows) - top + 1 !== recipe.height || Math.max(...columns) - left + 1 !== recipe.width) return false;

    for (const mirrored of [false, true]) {
        let matches = true;
        for (let row = 0; row < recipe.height && matches; row += 1) {
            for (let column = 0; column < recipe.width; column += 1) {
                const accepted = recipe.pattern[row * recipe.width + (mirrored ? recipe.width - 1 - column : column)];
                const slug = slugs[(top + row) * 3 + left + column];
                if (accepted ? !accepted.includes(slug) : slug) { matches = false; break; }
            }
        }
        if (matches) return true;
    }
    return false;
}

export function matchShapeless(slugs, recipe) {
    const actual = slugs.filter(Boolean);
    if (actual.length !== recipe.ingredients.length) return false;
    const groups = [...recipe.ingredients].sort((a, b) => a.length - b.length);
    const search = (index, remaining) => {
        if (index === groups.length) return true;
        return remaining.some((slug, position) => groups[index].includes(slug)
            && search(index + 1, remaining.filter((_, other) => other !== position)));
    };
    return search(0, actual);
}

export function findGridRecipe(cells, catalog) {
    const slugs = cells.map(cell => cell?.slug ?? null);
    if (!slugs.some(Boolean)) return null;
    const recipes = catalog.recipesByStation.get("crafting_table") ?? [];

    for (const recipe of recipes) {
        const matched = (recipe.kind === "shaped" && matchShaped(slugs, recipe))
            || (recipe.kind === "shapeless" && matchShapeless(slugs, recipe));
        if (matched) return { recipe, result: recipe.result };
    }
    for (const recipe of recipes) {
        const match = recipe.kind === "transmute" ? matchTransmute(cells, recipe)
            : recipe.kind === "special" ? matchSpecial(cells, recipe, catalog) : null;
        if (match) return { recipe, ...match };
    }
    return null;
}

export const gridStation = {
    repeatable: true,
    slots: () => ["0", "1", "2", "3", "4", "5", "6", "7", "8"],

    preview({ slots, catalog }) {
        const cells = Array.from({ length: 9 }, (_, index) => slots[index] ?? null);
        const match = findGridRecipe(cells, catalog);
        if (!match) return null;

        const kept = new Set(match.keep ?? []);
        const consumed = cells.map((cell, index) => ({ cell, index })).filter(({ cell, index }) => cell && !kept.has(index));
        return {
            recipeKey: match.recipe.recipeKey,
            result: match.result,
            consume: consumed.map(({ cell }) => ({ cell, quantity: 1 })),
            remainders: consumed.map(({ cell }) => CRAFTING_REMAINDERS[cell.slug]).filter(Boolean),
        };
    },
};
