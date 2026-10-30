import mongoose from "mongoose";

// Робота печі або варильної стійки: виконується за часом і не потребує відкритого застосунку
const StationJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  station: {
    type: String,
    required: true
  },
  recipeKey: String,
  input: {
    slug: String,
    components: mongoose.Schema.Types.Mixed
  },
  output: {
    slug: String,
    quantity: Number,
    components: mongoose.Schema.Types.Mixed
  },
  units: {
    type: Number,
    required: true
  },
  inputPerUnit: {
    type: Number,
    default: 1
  },
  collectedUnits: {
    type: Number,
    default: 0
  },
  unitMs: {
    type: Number,
    required: true
  },
  startedAt: {
    type: Date,
    required: true
  }
}, { timestamps: true });

StationJobSchema.index({ userId: 1, station: 1 }, { unique: true });

export default mongoose.model("StationJob", StationJobSchema);
