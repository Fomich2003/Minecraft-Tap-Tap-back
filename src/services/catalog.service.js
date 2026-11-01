import GameData from "../models/GameData.model.js";
import ItemModel from "../models/Item.model.js";
import RecipeModel from "../models/Recipe.model.js";
import StationModel from "../models/Station.model.js";
import { FIXED_PRICES, sellPriceOf } from "../data/pricing.js";

// Каталог змінюється лише імпортом, тому тримається в пам'яті процесу
class CatalogService {
    loading = null;

    get() {
        if (!this.loading) {
            this.loading = this.load().catch(error => {
                this.loading = null;
                throw error;
            });
        }
        return this.loading;
    }

    async load() {
        const [storedItems, recipes, stations, gameData] = await Promise.all([
            ItemModel.find().lean(),
            RecipeModel.find().lean(),
            StationModel.find().sort({ order: 1 }).lean(),
            GameData.find().lean(),
        ]);

        // Ціни рахуються тут, щоб зміна балансу не потребувала імпорту каталогу в базу
        const items = storedItems.map(item => {
            const marketPrice = FIXED_PRICES[item.slug] ?? item.marketPrice;
            return { ...item, marketPrice, sellPrice: item.sellPrice ? sellPriceOf(marketPrice) : 0 };
        });

        const recipesByStation = new Map();
        for (const recipe of recipes) {
            if (!recipesByStation.has(recipe.station)) recipesByStation.set(recipe.station, []);
            recipesByStation.get(recipe.station).push(recipe);
        }

        return {
            items,
            itemBySlug: new Map(items.map(item => [item.slug, item])),
            itemById: new Map(items.map(item => [item._id.toString(), item])),
            recipes,
            recipesByStation,
            stations,
            stationBySlug: new Map(stations.map(station => [station.slug, station])),
            game: Object.fromEntries(gameData.map(entry => [entry.key, entry.value])),
        };
    }
}

export default new CatalogService();
