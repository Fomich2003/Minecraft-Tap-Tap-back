import mongoose from "mongoose";

// Довідники зі згенерованого каталогу: зачарування, візерунки, паливо, оздоблення
const GameDataSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed
}, { timestamps: true });

export default mongoose.model("GameData", GameDataSchema);
