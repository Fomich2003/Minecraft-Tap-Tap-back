import { Telegram } from "telegraf";

// Окремий клієнт: сервісам не треба знати про обробники бота, а надсилання не залежить від опитування
const telegram = new Telegram(process.env.BOT_TOKEN);

// Гравець міг заблокувати бота: це не привід ламати гру
export async function notifyPlayer(telegramId, text) {
    try {
        await telegram.sendMessage(telegramId, text);
    } catch (error) {
        console.log("[bot-notify]", error.message);
    }
}
