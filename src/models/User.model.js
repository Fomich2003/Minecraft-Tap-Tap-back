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
  },
  // Slug куплених верстаків. Безкоштовні доступні всім і тут не зберігаються
  stations: [String],
  activeStation: {
    type: String,
    default: "crafting_table"
  },
  // Обмеження швидкості тапів
  lastTapAt: {
    type: Date,
    default: null
  },
  tapTokens: {
    type: Number,
    default: 120
  },
  // Скільки тапів уже зроблено по блоку до наступного дропа
  tapProgress: {
    type: Map,
    of: Number,
    default: {}
  },
  brewingFuel: {
    type: Number,
    default: 0
  },
  enchantSeed: {
    type: Number,
    default: 1
  }
}, { timestamps: true });

export default mongoose.model("User", UserSchema);
