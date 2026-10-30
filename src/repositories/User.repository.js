import UserModel from "../models/User.model.js";

const AWARD_AMOUNT = 500;
const AWARD_COOLDOWN_MS = 24 * 60 * 60 * 1000;

class UserRepository {
  async findAll() {
    return await UserModel.find();
  }

  async findByUsername(username) {
    return await UserModel.findOne({ username });
  }

  async findByTelegramId(id) {
    return await UserModel.findOne({ telegramId: id })
      .populate("tapBlocks", "slug type canTap icon price name")
      .lean();
  }

  async findById(id) {
    return await UserModel.findById(id).populate("tapBlocks", "slug type canTap icon price name");
  }

  async upsertFromTelegram(tgUser) {
    const update = { $setOnInsert: { telegramId: tgUser.id } };
    const profile = {};
    if (tgUser.username) profile.username = tgUser.username;
    if (tgUser.first_name) profile.firstName = tgUser.first_name;
    if (Object.keys(profile).length) update.$set = profile;
    const options = { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true };
    const run = () => UserModel.findOneAndUpdate({ telegramId: tgUser.id }, update, options)
      .populate("tapBlocks", "slug type canTap icon price name")
      .lean();

    try {
      return await run();
    } catch (error) {
      // Два паралельні перші входи: один створив документ, другий просто читає його
      if (error.code !== 11000) throw error;
      return await run();
    }
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

  async setActiveStation(userId, slug) {
    return await UserModel.findByIdAndUpdate(userId, { $set: { activeStation: slug } }, { new: true });
  }

  async bumpEnchantSeed(userId) {
    return await UserModel.findByIdAndUpdate(userId, { $inc: { enchantSeed: 1 } });
  }

  async changeBrewingFuel(userId, change) {
    return await UserModel.findByIdAndUpdate(userId, { $inc: { brewingFuel: change } }, { new: true });
  }

  async findTapState(userId) {
    return await UserModel.findById(userId).select("lastTapAt tapTokens tapProgress");
  }

  // Умова на lastTapAt відкидає запис, якщо паралельний запит встиг змінити лічильники
  async applyTaps(userId, lastTapAt, { taps, tokens, now, slug, progress }) {
    return await UserModel.findOneAndUpdate(
      { _id: userId, lastTapAt },
      {
        $inc: { balance: taps },
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
    console.log("[addTapBlock]", id, blockId)
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
  async claimAward(userId) {
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
          balance: AWARD_AMOUNT
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