import fs from "node:fs";
import User from "../../repositories/User.repository.js";

const texts = JSON.parse(fs.readFileSync(new URL("../../data/bot-texts.json", import.meta.url), "utf8"));
const DEFAULT_TEXTS = { prompt: "Натисни кнопку, щоб відкрити гру", play: "Грати" };
const GAME_URL = process.env.WEB_APP_URL || "https://tap-tap.fomka.online/";

// Новий гравець ще не обрав мову в грі, тому береться мова його Telegram
function textsFor(code = "") {
    return texts[code] ?? texts[code.split("-")[0]] ?? DEFAULT_TEXTS;
}

async function startCMD(ctx) {
    // Кнопка Mini App працює лише в особистому чаті з бото
    if (ctx.chat?.type !== "private") return;
    try {
        // Збій бази не має лишати гравця без запрошення
        const user = await User.findByTelegramId(ctx.from.id).catch(() => null);
        const { prompt, play } = textsFor(user?.language ?? ctx.from.language_code);
        await ctx.reply(prompt, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: play,
                            web_app: {
                                url: GAME_URL
                            }
                        }
                    ]
                ]
            }
        });
    } catch (error) {
        console.log("[bot-startCMD]", error.message)
    }
}

export default startCMD


// const exUser = await User.findByTelegramId(userInfo.id);
// let isNewUser = false;

// if (!exUser) {
//     isNewUser = true;
//     const block = await ItemModel.findOne({ slug: "oak_log" })
//     const createdUser = await User.create({
//         telegramId: userInfo.id,
//         username: userInfo.username,
//         tapBlocks: [block._id]
//     });
//     await Inventory.create(createdUser._id)
// }

// ctx.reply("click", {
//     reply_markup: {
//         inline_keyboard: [[
//             {
//                 text: `${isNewUser ? `Hello new User ${userInfo.username}` : "Hello"} 🚀 Open WebApp`,
//                 web_app: {
//                     url: "https://animal.fomka.online"
//                 }
//             }
//         ]]
//     }
// });