import shopService from "./shop.service.js";
import catalogService from "./catalog.service.js";

// Перелік предметів і довідники для клієнта. Рецепти перевіряє сервер під час крафту
class CraftingService {
    async getClientCatalog() {
        const catalog = await catalogService.get();
        const { items, game } = catalog;
        return {
            items: items.map(item => ({
                slug: item.slug, name: item.name, icon: item.icon, type: item.type, maxStack: item.maxStack,
                maxDurability: item.maxDurability, marketPrice: item.marketPrice, sellPrice: item.sellPrice,
                buyable: item.buyable, creativeOnly: item.creativeOnly, food: Boolean(item.food?.nutrition) && !item.slug.endsWith("_bucket"),
            })),
            ...shopService.variants(catalog),
            potionNames: game.potionNames,
            enchantmentNames: Object.fromEntries(Object.entries(game.enchantments ?? {}).map(([id, data]) => [id, data.name])),
            trimMaterials: game.trimMaterials,
            trimPatterns: game.trimPatterns,
        };
    }
}

export default new CraftingService();
