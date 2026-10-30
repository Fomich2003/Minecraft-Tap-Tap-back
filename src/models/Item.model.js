import mongoose from "mongoose";

const DropItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true
  },
  chance: {
    type: Number,
    min: 1,
    max: 100,
    default: 100
  }
}, { _id: false });

const ItemSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  nameEn: String,
  type: {
    type: String,
    enum: ["material", "fuel", "ingot", "tool", "weapon", "armor", "food", "potion", "ores", "block"],
    required: true
  },
  isBlock: {
    type: Boolean,
    default: false
  },
  stackable: {
    type: Boolean,
    default: true
  },
  maxStack: {
    type: Number,
    default: 64
  },
  // Властивості оригінального предмета
  maxDurability: {
    type: Number,
    default: 0
  },
  repairWith: [String],
  enchantability: {
    type: Number,
    default: 0
  },
  food: {
    nutrition: Number,
    saturation: Number
  },
  hardness: Number,
  creativeOnly: {
    type: Boolean,
    default: false
  },
  // Тапання
  canTap: {
    type: Boolean,
    default: false
  },
  canDrop: [DropItemSchema],
  tapsToBreak: {
    type: Number,
    default: 1
  },
  icon: String,
  // price: ціна блока для тапання, marketPrice: ціна предмета в магазині
  price: {
    type: Number,
    default: 0
  },
  isFirst: {
    type: Boolean,
    default: false
  },
  marketPrice: {
    type: Number,
    default: 0
  },
  sellPrice: {
    type: Number,
    default: 0
  },
  buyable: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

export default mongoose.model("Item", ItemSchema);
