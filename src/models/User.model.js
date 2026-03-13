import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0
  },
  tapBlocks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    unique: true
  }],
  // inventory: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: "Inventory",
  //   unique: true
  // }
}, { timestamps: true });

export default mongoose.model("User", UserSchema);

