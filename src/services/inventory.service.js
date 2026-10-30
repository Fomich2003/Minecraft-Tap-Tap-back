import Inventory from "../repositories/Inventory.repository.js";

class InventoryService {

    async getInventory(userId) {
        await Inventory.ensureExists(userId)
        return await Inventory.findByUserId(userId)
    }
}

const inventoryService = new InventoryService()

export default inventoryService
