import mongoose from "mongoose";

const StationSchema = new mongoose.Schema({
  slug: {
    type: String,
    unique: true,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  itemSlug: {
    type: String,
    required: true
  },
  // який інтерфейс показує клієнт
  uiType: {
    type: String,
    enum: ["grid", "cooking", "stonecutter", "smithing", "brewing", "anvil", "grindstone", "enchanting", "loom", "cartography"],
    required: true
  },
  price: {
    type: Number,
    default: 0
  },
  order: {
    type: Number,
    default: 0
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  needsFuel: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

export default mongoose.model("Station", StationSchema);
