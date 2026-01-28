import mongoose from "mongoose";

const PatternSlotSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item"
  },
  quantity: Number
}, { _id: false });

const RecipeSchema = new mongoose.Schema({
  station: {
    type: String,
    enum: ["workbench", "furnace"],
    required: true
  },
  // workbench (3x3)
  pattern: {
    type: [PatternSlotSchema],
    validate: v => !v || v.length === 9
  },
  // furnace
  input: {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
    quantity: Number
  },
  fuel: {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
    quantity: Number
  },
  result: {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true
    },
    quantity: {
      type: Number,
      required: true
    }
  },
  cookTime: Number
}, { timestamps: true });

export default mongoose.model("Recipe", RecipeSchema);