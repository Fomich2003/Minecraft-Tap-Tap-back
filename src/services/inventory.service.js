import Inventory from "../repositories/Inventory.repository.js";

class InventoryService {

    async createInventory(userId) {
        try {
            const inventory = await Inventory.create(userId);
            if (!inventory) return { success: false, message: "Inventory not created", status: 500 };
            return { success: true, inventory, status: 201 };
        } catch (error) {
            throw error;
        }

    }

    async getInventory(userId) {
        try {
            const inventory = await Inventory.findByUserId(userId)
            console.log("inventory", inventory, userId)
            if (!inventory) return { success: false, message: "Inventory not found", status: 404 };
            return { success: true, inventory, status: 200 };
        } catch (error) {
            throw error;
        }

    }


}

const inventoryService = new InventoryService()

export default inventoryService