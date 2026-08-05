import express from "express";
import "dotenv/config";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import blockRouter from "./src/routes/block.route.js";
import userRouter from "./src/routes/user.route.js";
import launchBot from "./src/bot/bot.js";
import connectDB from "./src/utils/connectDB.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
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

// База і бот 
connectDB();
launchBot();

app.listen(process.env.PORT, () => {
  console.log(`App is running on port ${process.env.PORT}`);
});