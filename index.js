import "dotenv/config";

import { createApp } from "./src/app.js";
import launchBot from "./src/bot/bot.js";
import connectDB from "./src/utils/connectDB.js";

const app = createApp();

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
