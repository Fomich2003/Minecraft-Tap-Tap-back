import mongoose from "mongoose"
import InventoryModel from "../models/Inventory.model.js"
import RecipeModel from "../models/Recipe.model.js"
import { addInventoryQuantity, removeInventoryQuantity } from "../utils/inventory-stacks.js"

export function assignShapelessIngredients(input, ingredients) {
    const requiredSlots = ingredients.flatMap(ingredient =>
        Array.from({ length: ingredient.quantity || 1 }, () => ingredient.itemIds)
    )
    const actual = input.filter(Boolean)
    if (actual.length !== requiredSlots.length) return null

    const orderedSlots = [...requiredSlots].sort((a, b) => a.length - b.length)
    const assigned = []
    const search = (index, remaining) => {
        if (index === orderedSlots.length) return remaining.length === 0
        const acceptedIds = orderedSlots[index]
        for (let position = 0; position < remaining.length; position += 1) {
            const slug = remaining[position]
            const item = acceptedIds.find(candidate => candidate.slug === slug)
            if (!item) continue
            const next = [...remaining]
            next.splice(position, 1)
            assigned[index] = item
            if (search(index + 1, next)) return true
        }
        assigned[index] = null
        return false
    }
    return search(0, actual) ? assigned : null
}

export function matchesRecipe(input, recipe) {
    if (recipe.shapeless) {
        const required = recipe.ingredients.flatMap(ingredient =>
            Array.from({ length: ingredient.quantity || 1 }, () => ingredient.itemIds.map(item => item.slug))
        );
        const actual = input.map(slug => slug || null).filter(Boolean);
        if (actual.length !== required.length) return false;
        return assignShapelessIngredients(input, recipe.ingredients) !== null;
    }

    const inputCells = input.map(slug => slug || null)
    const occupied = recipe.pattern.map((slot, index) => ({ slot, row: Math.floor(index / 3), column: index % 3 }))
        .filter(({ slot }) => slot?.itemId || slot?.itemIds?.length)
    if (!occupied.length) return false
    const minRow = Math.min(...occupied.map(value => value.row))
    const maxRow = Math.max(...occupied.map(value => value.row))
    const minColumn = Math.min(...occupied.map(value => value.column))
    const maxColumn = Math.max(...occupied.map(value => value.column))

    for (let mirrored = 0; mirrored < 2; mirrored += 1) {
        const width = maxColumn - minColumn + 1
        const height = maxRow - minRow + 1
        for (let rowOffset = 0; rowOffset <= 3 - height; rowOffset += 1) {
            for (let columnOffset = 0; columnOffset <= 3 - width; columnOffset += 1) {
                const acceptedSlots = Array(9).fill(null)
                for (const { slot, row, column } of occupied) {
                    const normalizedColumn = column - minColumn
                    const targetColumn = mirrored ? width - 1 - normalizedColumn : normalizedColumn
                    const targetRow = row - minRow
                    const targetIndex = (rowOffset + targetRow) * 3 + columnOffset + targetColumn
                    acceptedSlots[targetIndex] = slot.itemIds?.length
                        ? slot.itemIds.map(item => item.slug)
                        : [slot.itemId.slug]
                }
                if (acceptedSlots.every((accepted, index) =>
                    accepted ? accepted.includes(inputCells[index]) : !inputCells[index]
                )) return true
            }
        }
    }
    return false
}

class CraftingService {
    async getWorkbenchRecipes() {
        return RecipeModel.find({ station: "workbench" })
            .populate("pattern.itemId", "slug name icon")
            .populate("pattern.itemIds", "slug name icon")
            .populate("ingredients.itemIds", "slug name icon")
            .populate("result.itemId", "slug name icon")
            .lean()
    }

    async craft(userId, recipeId, input) {
        if (!mongoose.isValidObjectId(recipeId)) {
            return { success: false, status: 400, message: "Рецепт не знайдено" }
        }
        if (!Array.isArray(input) || input.length !== 9 || input.some(value => value !== null && typeof value !== "string")) {
            return { success: false, status: 400, message: "Сітка крафту некоректна" }
        }

        const recipe = await RecipeModel.findOne({ _id: recipeId, station: "workbench" })
            .populate("pattern.itemId", "slug")
            .populate("pattern.itemIds", "slug")
            .populate("ingredients.itemIds", "slug")
            .populate("result.itemId", "slug name icon type stackable maxStack")
        if (!recipe || !matchesRecipe(input, recipe)) {
            return { success: false, status: 400, message: "Розмісти предмети відповідно до рецепта" }
        }

        const inventory = await InventoryModel.findOne({ userId })
        if (!inventory) return { success: false, status: 404, message: "Інвентар не знайдено" }

        const required = new Map()
        const requiredItems = new Map()
        if (recipe.shapeless) {
            const matching = assignShapelessIngredients(input, recipe.ingredients);
            if (!matching) return { success: false, status: 400, message: "Recipe ingredients do not match" };
            matching.forEach(item => {
                required.set(item.slug, (required.get(item.slug) || 0) + 1);
                requiredItems.set(item.slug, item._id);
            });
        } else {
            recipe.pattern.forEach((cell, index) => {
                const acceptedIds = cell?.itemIds?.length ? cell.itemIds : cell?.itemId ? [cell.itemId] : [];
                const selected = acceptedIds.find(item => input[index] === item.slug);
                if (selected) {
                    required.set(selected.slug, (required.get(selected.slug) || 0) + (cell.quantity || 1));
                    requiredItems.set(selected.slug, selected._id);
                }
            });
        }

        const idsBySlug = new Map()
        for (const [slug, quantity] of required) {
            const itemId = requiredItems.get(slug)
            const available = inventory.items
                .filter(entry => entry.itemId.toString() === itemId.toString())
                .reduce((total, entry) => total + entry.quantity, 0)
            if (available < quantity) {
                return { success: false, status: 400, message: "Недостатньо матеріалів в інвентарі" }
            }
            idsBySlug.set(slug, itemId)
        }

        for (const [slug, quantity] of required) {
            removeInventoryQuantity(inventory, idsBySlug.get(slug), quantity)
        }

        const resultItem = await ItemModel.findById(recipe.result.itemId._id).select("stackable maxStack")
        addInventoryQuantity(inventory, resultItem, recipe.result.quantity)

        try {
            await inventory.save()
        } catch (error) {
            if (error.name === "VersionError") {
                return { success: false, status: 409, message: "Інвентар змінився. Спробуй ще раз" }
            }
            throw error
        }

        await inventory.populate("items.itemId")
        return { success: true, status: 200, inventory, result: recipe.result }
    }
}

export default new CraftingService()
