// Імпортуємо модель інвентарю з MongoDB
import InventoryModel from "../models/Inventory.model.js";

class InventoryRepository {

  // Отримати інвентар користувача за його userId
  // Також підтягуємо повну інформацію про предмети (populate)
  async findByUserId(userId) {
    return await InventoryModel.findOne({ userId })
      .populate("items.itemId");
  }

  // Створити новий інвентар для користувача
  async create(userId) {
    const newInventory = new InventoryModel({
      userId,      // ID користувача
      items: []    // Порожній список предметів
    });

    await newInventory.save();
    return newInventory;
  }

  // Додати предмет в інвентар
  // Якщо предмет уже існує — збільшуємо кількість
  async addItem(userId, itemId, quantity = 1) {
    const inventory = await InventoryModel.findOne({ userId });
    if (!inventory) return null;

    // Шукаємо предмет в інвентарі
    const item = inventory.items.find(
      el => el.itemId.toString() === itemId.toString()
    );

    if (item) {
      // Якщо предмет знайдено — збільшуємо кількість
      item.quantity += quantity;
    } else {
      // Якщо предмета немає — додаємо новий
      inventory.items.push({ itemId, quantity });
    }

    await inventory.save();
    return inventory;
  }

  // Видалити предмет з інвентаря
  // Або зменшити його кількість
  async removeItem(userId, itemId, quantity = 1) {
    const inventory = await InventoryModel.findOne({ userId });
    if (!inventory) return null;

    // Шукаємо предмет в інвентарі
    const item = inventory.items.find(
      el => el.itemId.toString() === itemId.toString()
    );

    // Якщо предмет не знайдено — повертаємо інвентар без змін
    if (!item) return inventory;

    // Зменшуємо кількість предметів
    item.quantity -= quantity;

    // Якщо кількість стала 0 або менше — повністю видаляємо предмет
    if (item.quantity <= 0) {
      inventory.items = inventory.items.filter(
        el => el.itemId.toString() !== itemId.toString()
      );
    }

    await inventory.save();
    return inventory;
  }
}

// Створюємо єдиний екземпляр репозиторію
const   Inventory = new InventoryRepository();

// Експортуємо для використання в інших файлах
export default Inventory;
