import mongoose from "mongoose";

// Рецепти це довідкові дані гри, тому посилаються на предмети через стабільний slug
const RecipeSchema = new mongoose.Schema({
  recipeKey: { type: String, required: true, unique: true },
  station: { type: String, required: true, index: true },
  kind: {
    type: String,
    enum: ["shaped", "shapeless", "cooking", "stonecutting", "smithing_transform", "smithing_trim", "brewing", "transmute", "special"],
    required: true
  },
  specialType: String,
  group: String,
  // shaped: комірки width * height, у кожній список допустимих slug або null
  width: Number,
  height: Number,
  pattern: [mongoose.Schema.Types.Mixed],
  // shapeless: список допустимих slug на кожен інгредієнт
  ingredients: [[String]],
  // cooking, stonecutting: допустимі вхідні предмети
  input: [String],
  cookTime: Number,
  experience: Number,
  // smithing
  template: [String],
  base: [String],
  addition: [String],
  // brewing
  brewing: {
    item: String,
    potion: String,
    reagent: String,
    outputItem: String,
    outputPotion: String
  },
  // параметри особливих рецептів
  data: mongoose.Schema.Types.Mixed,
  result: {
    slug: String,
    quantity: { type: Number, default: 1 },
    components: mongoose.Schema.Types.Mixed
  }
}, { timestamps: true });

export default mongoose.model("Recipe", RecipeSchema);
