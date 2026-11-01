import UserModel from "../models/User.model.js";

const AWARD_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const TAP_BLOCK_FIELDS = "slug type canTap icon price name tapsToBreak";

// Користувачі, створені до появи покращень, не мають поля tapLevel
const tapLevelFilter = level => (level ? level : { $in: [0, null] });

class UserRepository {
  async findAll() {
    return await UserModel.find();
  }

  async findByUsername(username) {
    return await UserModel.findOne({ username });
  }

  async findByTelegramId(id) {
    return await UserModel.findOne({ telegramId: id })
      .populate("tapBlocks", TAP_BLOCK_FIELDS)
      .lean();
  }

  async findById(id) {
    return await UserModel.findById(id).populate("tapBlocks", TAP_BLOCK_FIELDS);
  }

  async upsertFromTelegram(tgUser) {
    const update = { $setOnInsert: { telegramId: tgUser.id } };
    const profile = {};
    if (tgUser.username) profile.username = tgUser.username;
    if (tgUser.first_name) profile.firstName = tgUser.first_name;
    if (Object.keys(profile).length) update.$set = profile;
    const options = { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true };
    const run = () => UserModel.findOneAndUpdate({ telegramId: tgUser.id }, update, options)
      .populate("tapBlocks", TAP_BLOCK_FIELDS)
      .lean();

    try {
      return await run();
    } catch (error) {
      // Два паралельні перші входи: один створив документ, другий просто читає його
      if (error.code !== 11000) throw error;
      return await run();
    }
  }

  // Вставка лише для нового гравця: наявний документ не змінюється. Повертає, чи створено запис
  async createReferred(tgUser, inviterId) {
    try {
      const existing = await UserModel.findOneAndUpdate(
        { telegramId: tgUser.id },
        { $setOnInsert: { telegramId: tgUser.id, username: tgUser.username ?? null, firstName: tgUser.first_name ?? null, referredBy: inviterId } },
        { upsert: true, returnDocument: "before", setDefaultsOnInsert: true }
      ).lean();
      return !existing;
    } catch (error) {
      // Два паралельні /start: перший уже створив гравця
      if (error.code === 11000) return false;
      throw error;
    }
  }

  // Умова в самому запиті: паралельні запити профілю не видадуть нагороду двічі
  async claimReferral(userId, coins) {
    return await UserModel.findOneAndUpdate(
      { _id: userId, referredBy: { $ne: null }, referralPaid: { $ne: true } },
      { $set: { referralPaid: true }, $inc: { balance: coins } },
      { new: true }
    );
  }

  async addReferral(userId, coins) {
    return await UserModel.updateOne({ _id: userId }, { $inc: { referrals: 1, balance: coins } });
  }

  async leaderboardRows(filter, score, bossKills, limit) {
    return await UserModel.aggregate([
      { $match: filter },
      {
        $project: {
          firstName: 1,
          username: 1,
          balance: { $ifNull: ["$balance", 0] },
          xpTotal: { $ifNull: ["$xpTotal", 0] },
          bosses: bossKills,
          score,
        }
      },
      { $sort: { score: -1, _id: 1 } },
      { $limit: limit },
    ]);
  }

  async countAbove(score, value) {
    return await UserModel.countDocuments({ $expr: { $gt: [score, value] } });
  }

  async incrementBalance(userId, count) {
    return await UserModel.findByIdAndUpdate(
      userId,
      {
        $inc: {
          balance: count
        }
      },
      {
        new: true,          // повертає вже оновлений документ
        runValidators: true // валідація по схемі
      }
    )
  }

  async decrementBalance(userId, count) {
    return await UserModel.findByIdAndUpdate(
      userId,
      {
        $inc: {
          balance: -count
        }
      },
      {
        new: true,          // повертає вже оновлений документ
        runValidators: true // валідація по схемі
      }
    )
  }



  async addBookshelves(userId, count, limit) {
    return await UserModel.findOneAndUpdate(
      { _id: userId, bookshelves: { $not: { $gt: limit - count } } },
      { $inc: { bookshelves: count } },
      { new: true }
    );
  }

  async setKnowledge(userId) {
    return await UserModel.findByIdAndUpdate(userId, { $set: { knowledge: true } }, { new: true });
  }

  async setProfileBanner(userId, banner) {
    return await UserModel.findByIdAndUpdate(userId, { $set: { profileBanner: banner } }, { new: true });
  }

  async addXp(userId, amount) {
    return await UserModel.findByIdAndUpdate(userId, { $inc: { xp: amount, xpTotal: amount } }, { new: true });
  }

  async spendXp(userId, amount) {
    return await UserModel.findOneAndUpdate({ _id: userId, xp: { $gte: amount } }, { $inc: { xp: -amount } }, { new: true });
  }

  async refundXp(userId, amount) {
    return await UserModel.findByIdAndUpdate(userId, { $inc: { xp: amount } }, { new: true });
  }

  async spendCoins(userId, amount) {
    return await UserModel.findOneAndUpdate(
      { _id: userId, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: true }
    );
  }

  async purchaseStation(userId, slug, price) {
    return await UserModel.findOneAndUpdate(
      { _id: userId, balance: { $gte: price }, stations: { $ne: slug } },
      { $inc: { balance: -price }, $addToSet: { stations: slug } },
      { new: true }
    );
  }

  async purchaseMob(userId, slug, price) {
    return await UserModel.findOneAndUpdate(
      { _id: userId, balance: { $gte: price }, mobs: { $ne: slug } },
      { $inc: { balance: -price }, $addToSet: { mobs: slug } },
      { new: true }
    );
  }

  async summonBoss(userId, slug, progressKey, { now, readyAt, expiresAt }) {
    return await UserModel.findOneAndUpdate(
      { _id: userId, $or: [{ [`bosses.${slug}.readyAt`]: null }, { [`bosses.${slug}.readyAt`]: { $lte: now } }] },
      { $set: { [`bosses.${slug}`]: { active: true, readyAt, expiresAt }, [`tapProgress.${progressKey}`]: 0 } },
      { new: true }
    );
  }

  // Лише перший запит знаходить active: так нагорода за боса не видається двічі
  async finishBoss(userId, slug) {
    return await UserModel.findOneAndUpdate(
      { _id: userId, [`bosses.${slug}.active`]: true },
      { $set: { [`bosses.${slug}.active`]: false } },
      { new: true }
    );
  }

  async addMobKills(userId, slug, kills) {
    return await UserModel.updateOne({ _id: userId }, { $inc: { [`mobKills.${slug}`]: kills } });
  }

  async setActiveStation(userId, slug) {
    return await UserModel.findByIdAndUpdate(userId, { $set: { activeStation: slug } }, { new: true });
  }

  async bumpEnchantSeed(userId) {
    return await UserModel.findByIdAndUpdate(userId, { $inc: { enchantSeed: 1 } });
  }

  async changeBrewingFuel(userId, change) {
    return await UserModel.findByIdAndUpdate(userId, { $inc: { brewingFuel: change } }, { new: true });
  }

  async setTool(userId, kind, stackId) {
    return await UserModel.findByIdAndUpdate(userId, { $set: { [`tools.${kind}`]: stackId } }, { new: true });
  }

  async setEffects(userId, effects) {
    return await UserModel.findByIdAndUpdate(userId, { $set: { effects } }, { new: true });
  }

  async setLanguage(userId, language) {
    return await UserModel.findByIdAndUpdate(userId, { $set: { language } }, { new: true });
  }

  // Умова на день: паралельні запити не перезапишуть уже розпочату добу
  async startDaily(userId, day, daily) {
    return await UserModel.updateOne({ _id: userId, "daily.day": { $ne: day } }, { $set: { daily } });
  }

  async addQuestProgress(userId, increments) {
    const $inc = {};
    for (const [metric, value] of Object.entries(increments)) {
      $inc[`questStats.${metric}`] = value;
      $inc[`daily.progress.${metric}`] = value;
    }
    return await UserModel.updateOne({ _id: userId }, { $inc });
  }

  async claimDailyQuest(userId, day, id, progressFilter, coins, xp) {
    return await UserModel.findOneAndUpdate(
      { _id: userId, "daily.day": day, "daily.ids": id, "daily.claimed": { $ne: id }, ...progressFilter },
      { $addToSet: { "daily.claimed": id }, $inc: { balance: coins, xp, xpTotal: xp, "questStats.dailies": 1 } },
      { new: true }
    );
  }

  async claimPermanentQuest(userId, id, progressFilter, coins, xp) {
    return await UserModel.findOneAndUpdate(
      { _id: userId, questsClaimed: { $ne: id }, ...progressFilter },
      { $addToSet: { questsClaimed: id }, $inc: { balance: coins, xp, xpTotal: xp } },
      { new: true }
    );
  }

  async findTapState(userId) {
    return await UserModel.findById(userId).select("lastTapAt tapTokens tapProgress tapLevel");
  }

  // Умови на lastTapAt і tapLevel відкидають запис, якщо паралельний запит встиг змінити лічильники або рівень
  async applyTaps(userId, lastTapAt, tapLevel, { coins, tokens, now, slug, progress }) {
    return await UserModel.findOneAndUpdate(
      { _id: userId, lastTapAt, tapLevel: tapLevelFilter(tapLevel) },
      {
        $inc: { balance: coins },
        $set: { lastTapAt: now, tapTokens: tokens, [`tapProgress.${slug}`]: progress }
      },
      { new: true }
    );
  }

  async update(id, data) {
    return await UserModel.findByIdAndUpdate(
      id,
      { $set: data },
      {
        new: true,          // повертає вже оновлений документ
        runValidators: true // валідація по схемі
      },
    );
  }


  async addTapBlock(id, blockId) {
    return await UserModel.findByIdAndUpdate(
      id,
      { $addToSet: { tapBlocks: blockId } },
      {
        new: true,
        runValidators: true
      }
    );
  }

  // Умова в самому запиті не дає забрати нагороду двічі паралельними запитами
  async claimAward(userId, amount) {
    const now = new Date();
    return await UserModel.findOneAndUpdate(
      {
        _id: userId,
        $or: [
          { lastAwardTime: null },
          { lastAwardTime: { $lte: new Date(now.getTime() - AWARD_COOLDOWN_MS) } }
        ]
      },
      {
        $inc: {
          balance: amount
        },
        $set: {
          lastAwardTime: now
        }
      },
      {
        new: true,          // повертає вже оновлений документ
        runValidators: true // валідація по схемі
      }
    )
  }

  // Скидання і підвищення рівня відбуваються однією операцією. Умова на рівень не дає
  // двом паралельним запитам (подвійний клік) купити одне покращення двічі.
  async purchaseTapUpgrade(userId, level, cost) {
    return await UserModel.findOneAndUpdate(
      { _id: userId, tapLevel: tapLevelFilter(level), balance: { $gte: cost } },
      { $set: { balance: 0, tapLevel: level + 1 } },
      { new: true, runValidators: true }
    );
  }

  // Списує монети і видає блок однією операцією, тому паралельні покупки не йдуть у мінус
  async purchaseTapBlock(userId, blockId, price) {
    return await UserModel.findOneAndUpdate(
      { _id: userId, balance: { $gte: price }, tapBlocks: { $ne: blockId } },
      { $inc: { balance: -price }, $addToSet: { tapBlocks: blockId } },
      { new: true, runValidators: true }
    );
  }

}

const User = new UserRepository();

export default User;