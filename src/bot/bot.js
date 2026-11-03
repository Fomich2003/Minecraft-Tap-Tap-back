import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import startCMD, { GAME_URL, PLAY_LABEL } from "./commands/start.js";

const RETRY_MS = 15000;
const COMMANDS = [
    { command: "start", description: "Open the game" },
    { command: "play", description: "Play" },
];
const MENU_BUTTON = { type: "web_app", text: PLAY_LABEL, web_app: { url: GAME_URL } };

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(startCMD);
bot.command("play", startCMD);
// Будь-яке повідомлення, зокрема слово «Грати», теж запрошує в гру
bot.on(message("text"), startCMD);
bot.catch(error => console.log("[bot]", `Update failed: ${error.message}`));

// Telegram тримає старе з'єднання кілька секунд після перезапуску сервера, а мережа може зникнути: бот сам повертається
export default async function launchBot() {

    console.log("[bot]", "try to start bot...")

    try {
        await bot.telegram.setMyCommands(COMMANDS);
        await bot.telegram.setChatMenuButton({ menuButton: MENU_BUTTON });
        await bot.launch(() => console.log("[bot]", "Bot was started"));
    } catch (error) {
        console.log("[bot]", `Bot is error: ${error.message}`)
        setTimeout(launchBot, RETRY_MS);
    }

}

export { bot };
