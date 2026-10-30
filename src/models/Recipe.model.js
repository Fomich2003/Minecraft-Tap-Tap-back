import mongoose from "mongoose";

const PatternSlotSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item"
  },
  itemIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item"
  }],
  quantity: Number
}, { _id: false });

const IngredientSchema = new mongoose.Schema({
  itemIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true
  }],
  quantity: { type: Number, default: 1 }
}, { _id: false });

const RecipeSchema = new mongoose.Schema({
  recipeKey: { type: String, unique: true, sparse: true },
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
  shapeless: { type: Boolean, default: false },
  ingredients: [IngredientSchema],
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
