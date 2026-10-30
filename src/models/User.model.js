import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  // Telegram не гарантує username, а користувач може його змінити
  username: {
    type: String,
    default: null
  },
  firstName: {
    type: String,
    default: null
  },
  balance: {
    type: Number,
    default: 0
  },
  tapBlocks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item"
  }],
  lastAwardTime: {
    type: Date,
    default: null
  }
}, { timestamps: true });

export default mongoose.model("User", UserSchema);
