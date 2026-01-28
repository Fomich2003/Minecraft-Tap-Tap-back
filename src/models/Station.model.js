import mongoose from "mongoose";

const StationSchema = new mongoose.Schema({
  slug: {
    type: String,
    enum: ["workbench", "furnace"],
    unique: true,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  gridSize: {
    type: Number,
    required: true
  }
}, { timestamps: true });

export default mongoose.model("Station", StationSchema);