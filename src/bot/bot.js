import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import startCMD from "./commands/start.js";

const RETRY_MS = 15000;
const COMMANDS = [
    { command: "start", description: "Запросити в гру" },
    { command: "play", description: "Грати" },
];

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
        await bot.launch(() => console.log("[bot]", "Bot was started"));
    } catch (error) {
        console.log("[bot]", `Bot is error: ${error.message}`)
        setTimeout(launchBot, RETRY_MS);
    }

}

export { bot };

// bot.on('message', async (ctx) => {
//     console.log('MESSAGE:', JSON.stringify(ctx.message, null, 2));
//     const newItem = new ItemModel({
//         slug: "stone",
//         name: "Камінь",
//         type: "block",
//         stackable: true,
//         maxStack: 64,
//         icon: "/items/stone.png",
//         canTap: true,
//         canDrop: [
//             {
//                 itemId: "697cf2e2523224dabc28f2a3",
//                 chance: 90

//             },
//             {
//                 itemId: "69835ac5f4bf558f4d6bed54",
//                 chance: 10
//             }
//         ]
//     })

//     newItem.save()

//     const newItem1 = new ItemModel({
//         slug: "coal_ore",
//         name: "Вугільна руда",
//         type: "block",
//         stackable: true,
//         maxStack: 64,
//         icon: "/items/coal_ore.png",
//         canTap: true,
//         canDrop: [
//             {
//                 itemId: "69835ac5f4bf558f4d6bed54",
//                 chance: 100

//             }
//         ]
//     })

//     newItem1.save()

//     const newItem2 = new ItemModel({
//         slug: "oak_log",
//         name: "Колода дуба",
//         type: "block",
//         stackable: true,
//         maxStack: 64,
//         icon: "/items/oak_log.png",
//         canTap: true,
//         canDrop: [
//             {
//                 itemId: "6995e862bb65465a9753b78e",
//                 chance: 100

//             }
//         ]
//     })

//     newItem2.save()

//     const newItem3 = new ItemModel({
//         slug: "iron_ore",
//         name: "Залізна руда",
//         type: "block",
//         stackable: true,
//         maxStack: 64,
//         icon: "/items/iron_ore.png",
//         canTap: true,
//         canDrop: [
//             {
//                 itemId: "69835dd1f4bf558f4d6bed5e",
//                 chance: 100

//             }
//         ]
//     })

//     newItem3.save()
// });

