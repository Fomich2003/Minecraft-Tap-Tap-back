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
  // Рівень покращення тапа: спільний для всіх блоків
  tapLevel: {
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
  },
  // Id стаків з інвентаря, вдягнених на кожен вид блоків
  tools: {
    pickaxe: { type: mongoose.Schema.Types.ObjectId, default: null },
    axe: { type: mongoose.Schema.Types.ObjectId, default: null },
    shovel: { type: mongoose.Schema.Types.ObjectId, default: null },
    sword: { type: mongoose.Schema.Types.ObjectId, default: null }
  },
  effects: [{
    _id: false,
    id: String,
    level: Number,
    expiresAt: Date
  }],
  // xp витрачається, xpTotal лише росте і визначає рівень досвіду
  xp: {
    type: Number,
    default: 0
  },
  xpTotal: {
    type: Number,
    default: 0
  },
  // Поставлені біля столу полиці: куплені один раз і лишаються назавжди
  bookshelves: {
    type: Number,
    default: 0
  },
  // Книга знань відкриває всі рецепти
  knowledge: {
    type: Boolean,
    default: false
  },
  // Банер у профілі: копія властивостей, сам предмет лишається в інвентарі
  profileBanner: {
    base: { type: String, default: null },
    patterns: [{ _id: false, pattern: String, color: String }]
  },
  // Slug відкритих мобів. Безкоштовні доступні всім і тут не зберігаються
  mobs: [String],
  mobKills: {
    type: Map,
    of: Number,
    default: {}
  },
  // Бій із босом: readyAt коли можна призвати знову, expiresAt коли він утече
  bosses: {
    wither: { active: Boolean, readyAt: Date, expiresAt: Date },
    ender_dragon: { active: Boolean, readyAt: Date, expiresAt: Date }
  },
  // Колекційні карти: slug блока чи моба і скільки копій зібрано. Рівень карти виводиться з кількості
  cards: {
    type: Map,
    of: Number,
    default: {}
  },
  // Slug карт у колоді. Кількість слотів залежить від рівня досвіду
  deck: [String],
  // Лічильники постійних квестів за всю гру
  questStats: {
    type: Map,
    of: Number,
    default: {}
  },
  questsClaimed: [String],
  // Щоденні квести: набір фіксується на добу, лічильники обнуляються разом із ним
  daily: {
    day: { type: String, default: null },
    ids: [String],
    level: { type: Number, default: 0 },
    progress: { type: Map, of: Number, default: {} },
    claimed: [String]
  },
  // Мова, обрана в грі. Її читає бот, який не бачить налаштувань клієнта
  language: {
    type: String,
    default: null
  },
  // Хто запросив гравця. Нагорода видається один раз, коли він уперше зайде в гру
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  referralPaid: {
    type: Boolean,
    default: false
  },
  referrals: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

export default mongoose.model("User", UserSchema);
