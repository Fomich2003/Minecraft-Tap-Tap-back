import express from "express";
import { Telegraf } from "telegraf";
import "dotenv/config";
import User from "./src/repositories/User.repository.js";
import mongoose from "mongoose";
import ItemModel from "./src/models/Item.model.js";
import blockRouter from "./src/routes/block.route.js";
import Inventory from "./src/repositories/Inventory.repository.js";


const app = express();

app.use(express.json())

const bot = new Telegraf(process.env.BOT_TOKEN);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};

connectDB();

app.get("/", (req, res) => {
  res.send("Backend Starts");
});

app.use("/api/block", blockRouter)

bot.start(async (ctx) => {
  console.log(JSON.stringify(ctx.update.message.from, null, 2));
  console.log(JSON.stringify(ctx.update.message.chat, null, 2));

  const userInfo = ctx.update.message.from; // інформація про юзера з тг
  const exUser = await User.findByTelegramId(userInfo.id);
  let isNewUser = false;

  if (!exUser) {
    isNewUser = true;
    const block = await ItemModel.findOne({ slug: "oak_log" })
    const createdUser = await User.create({
      telegramId: userInfo.id,
      username: userInfo.username,
      tapBlocks: [block._id]
    });
    await Inventory.create(createdUser._id)
  }

  ctx.reply("click", {
    reply_markup: {
      inline_keyboard: [[
        {
          text: `${isNewUser ? `Hello new User ${userInfo.username}` : "Hello"} 🚀 Open WebApp`,
          web_app: {
            url: "https://animal.fonka.online"
          }
        }
      ]]
    }
  });
});

bot.on('message', async (ctx) => {
  console.log('MESSAGE:', JSON.stringify(ctx.message, null, 2));
  const newItem = new ItemModel({
    slug: "stone",
    name: "Камінь",
    type: "block",
    stackable: true,
    maxStack: 64,
    icon: "/items/stone.png",
    canTap: true,
    canDrop: [
      {
        itemId: "697cf2e2523224dabc28f2a3",
        chance: 90

      },
      {
        itemId: "69835ac5f4bf558f4d6bed54",
        chance: 10
      }
    ]
  })

  newItem.save()

    const newItem1 = new ItemModel({
    slug: "coal_ore",
    name: "Вугільна руда",
    type: "block",
    stackable: true,
    maxStack: 64,
    icon: "/items/coal_ore.png",
    canTap: true,
    canDrop: [
      {
        itemId: "69835ac5f4bf558f4d6bed54",
        chance: 100

      }
    ]
  })

  newItem1.save()

    const newItem2 = new ItemModel({
    slug: "oak_log",
    name: "Колода дуба",
    type: "block",
    stackable: true,
    maxStack: 64,
    icon: "/items/oak_log.png",
    canTap: true,
    canDrop: [
      {
        itemId: "6995e862bb65465a9753b78e",
        chance: 100

      }
    ]
  })

  newItem2.save()

    const newItem3 = new ItemModel({
    slug: "iron_ore",
    name: "Залізна руда",
    type: "block",
    stackable: true,
    maxStack: 64,
    icon: "/items/iron_ore.png",
    canTap: true,
    canDrop: [
      {
        itemId: "69835dd1f4bf558f4d6bed5e",
        chance: 100

      }
    ]
  })

  newItem3.save()
});

app.listen(process.env.PORT, () => {
  console.log("App was Running")
})

bot.launch()