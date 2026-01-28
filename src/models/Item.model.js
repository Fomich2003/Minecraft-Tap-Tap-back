import mongoose from "mongoose";

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
    enum: ["material", "fuel", "ingot", "tool"],
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
  icon: String
}, { timestamps: true });

export default mongoose.model("Item", ItemSchema);