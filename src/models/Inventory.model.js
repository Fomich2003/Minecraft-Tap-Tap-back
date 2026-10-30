import mongoose from "mongoose";

const InventoryItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  // Властивості конкретного екземпляра: зачарування, міцність, зілля, колір
  components: mongoose.Schema.Types.Mixed,
  // Канонічний запис components. Стаки об'єднуються лише за однакового ключа
  stackKey: {
    type: String,
    default: ""
  }
});

const InventorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    unique: true,
    required: true
  },
  items: [InventoryItemSchema]
}, { timestamps: true, optimisticConcurrency: true });

export default mongoose.model("Inventory", InventorySchema);
