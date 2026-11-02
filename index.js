import express from "express";
import "dotenv/config";
import cors from "cors";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";

import blockRouter from "./src/routes/block.route.js";
import userRouter from "./src/routes/user.route.js";
import inventoryRouter from "./src/routes/inventory.route.js";
import stationRouter from "./src/routes/station.route.js";
import questRouter from "./src/routes/quest.route.js";
import mobRouter from "./src/routes/mob.route.js";
import cardRouter from "./src/routes/card.route.js";

import launchBot from "./src/bot/bot.js";
import connectDB from "./src/utils/connectDB.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(compression());
app.use(express.json());
app.use(cors());

// Статичні файли
app.use("/items", express.static(path.join(__dirname, "src/assets/items")));

// Роути
app.get("/", (req, res) => {
  res.send("Backend Starts");
});

app.use("/api/block", blockRouter);
app.use("/api/user", userRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/station", stationRouter);
app.use("/api/quest", questRouter);
app.use("/api/mob", mobRouter);
app.use("/api/card", cardRouter);

// База і бот 
connectDB();

// Один токен може опитувати лише один процес, тому тестові сервери вимикають бота
if (process.env.BOT_POLLING !== "off") {
  launchBot();
}

app.listen(process.env.PORT, error => {
  if (error) {
    console.error(`Could not start on port ${process.env.PORT}:`, error.message);
    process.exit(1);
  }
  console.log(`App is running on port ${process.env.PORT}`);
});