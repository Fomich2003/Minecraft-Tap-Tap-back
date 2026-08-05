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
  type: {
    type: String,
    enum: ["material", "fuel", "ingot", "tool", "armor", "ores", "block"],
    required: true
  },
  stackable: {
    type: Boolean,
    default: true
  },
  maxStack: {
    type: Number,
    default: 64
  },
  canTap: {
    type: Boolean,
    default: false
  },
  canDrop: [DropItemSchema],
  icon: String,
  price: {
    type: Number,
    default: 0
  },
  isFirst: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

export default mongoose.model("Item", ItemSchema);