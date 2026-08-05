import { Telegraf } from "telegraf";
import startCMD from "./commands/start.js";

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(startCMD);

export default async function launchBot() {

    console.log("[bot]", "try to start bot...")


    bot.launch().then(() => {
        console.log("[bot]", "Bot was started")
    }).catch((e) => {
        console.log("[bot]", `Bot is error: ${e}`)
    })

}
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

