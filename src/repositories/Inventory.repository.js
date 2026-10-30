import InventoryModel from "../models/Inventory.model.js";
import ItemModel from "../models/Item.model.js";
import { addInventoryQuantity, removeInventoryQuantity } from "../utils/inventory-stacks.js";

class InventoryRepository {
  async findByUserId(userId) {
    const inventory = await InventoryModel.findOne({ userId }).populate("items.itemId");
    if (!inventory) return null;
    let normalized = false;
    for (const stack of [...inventory.items]) {
      if (stack.$isDefault?.("_id")) normalized = true;
      const maxStack = stack.itemId?.stackable === false ? 1 : Math.max(1, Number(stack.itemId?.maxStack) || 64);
      while (stack.quantity > maxStack) {
        if (!stack.itemId?._id) break;
        stack.quantity -= maxStack;
        inventory.items.push({ itemId: stack.itemId._id, quantity: maxStack });
        normalized = true;
      }
    }
    if (normalized) await inventory.save();
    return inventory;
  }

  async ensureExists(userId) {
    try {
      await InventoryModel.updateOne({ userId }, { $setOnInsert: { items: [] } }, { upsert: true });
    } catch (error) {
      // Паралельний запит міг створити інвентар раніше
      if (error.code !== 11000) throw error;
    }
  }

  async addItem(userId, itemId, quantity = 1) {
    const [inventory, item] = await Promise.all([
      InventoryModel.findOne({ userId }),
      ItemModel.findById(itemId).select("stackable maxStack")
    ]);
    if (!inventory || !item || quantity <= 0) return inventory;
    addInventoryQuantity(inventory, item, quantity);
    await inventory.save();
    return inventory;
  }

  async removeItem(userId, itemId, quantity = 1) {
    const inventory = await InventoryModel.findOne({ userId });
    if (!inventory) return null;
    if (removeInventoryQuantity(inventory, itemId, quantity)) await inventory.save();
    return inventory;
  }
}

export default new InventoryRepository();
