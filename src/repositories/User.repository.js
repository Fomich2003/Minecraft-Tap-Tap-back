import UserModel from "../models/User.model.js";

class UserRepository {
  async findAll() {
    return await UserModel.find();
  }

  async findByUsername(username) {
    return await UserModel.findOne({ username });
  }

  async findByTelegramId(id) {
    return await UserModel.findOne({ telegramId: id }).populate("tapBlocks", "slug type canTap");
  }

  async findById(id) {
    return await UserModel.findById(id);
  }

  async create(user) {
    const newUser = new UserModel(user);
    await newUser.save();
    return newUser;
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

}

const User = new UserRepository();

export default User;