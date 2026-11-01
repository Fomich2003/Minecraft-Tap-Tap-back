import InventoryModel from "../models/Inventory.model.js";
import { addInventoryQuantity } from "../utils/inventory-stacks.js";

const ITEM_FIELDS = "slug name icon type stackable maxStack maxDurability marketPrice sellPrice buyable food";
const MAX_SAVE_ATTEMPTS = 12;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

class InventoryRepository {
  async findByUserId(userId) {
    return await InventoryModel.findOne({ userId }).populate("items.itemId", ITEM_FIELDS);
  }

  async findPlainByUserId(userId) {
    return await InventoryModel.findOne({ userId });
  }

  async ensureExists(userId) {
    try {
      await InventoryModel.updateOne({ userId }, { $setOnInsert: { items: [] } }, { upsert: true });
    } catch (error) {
      // Паралельний запит міг створити інвентар раніше
      if (error.code !== 11000) throw error;
    }
  }

  // Інвентар змінюють паралельні запити, тому зміна повторюється на свіжій версії документа.
  // mutator повертає { abort: true }, якщо зберігати нічого не треба.
  async mutate(userId, mutator) {
    for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt += 1) {
      const inventory = await InventoryModel.findOne({ userId });
      if (!inventory) return { abort: true, status: 404, message: "Інвентар не знайдено" };

      const result = await mutator(inventory);
      if (result?.abort) return result;

      try {
        await inventory.save();
        return result ?? {};
      } catch (error) {
        if (error.name !== "VersionError") throw error;
        await delay(Math.random() * 25 * (attempt + 1));
      }
    }
    throw new Error("Інвентар зайнятий, спробуй ще раз");
  }

  async addItems(userId, entries) {
    return await this.mutate(userId, inventory => {
      for (const { item, quantity, components } of entries) addInventoryQuantity(inventory, item, quantity, components);
    });
  }
}

export default new InventoryRepository();
