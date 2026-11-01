import referralService from "../../services/referral.service.js";

const GAME_URL = process.env.WEB_APP_URL || "https://tap-tap.fomka.online/";
const PROMPT = "Welcome to Minecraft Tap-Tap! Mine blocks, craft items, fight bosses and climb the leaderboard. Press the button to play.";
const INVITED_PROMPT = "Your friend invited you to Minecraft Tap-Tap! Press the button to open the game and get your welcome bonus.";
const PLAY_LABEL = "Play";

async function startCMD(ctx) {
    // Кнопка Mini App працює лише в особистому чаті з бото
    if (ctx.chat?.type !== "private") return;
    try {
        // Збій бази не має лишати гравця без запрошення
        const invited = await referralService.register(ctx.from, ctx.payload).catch(error => {
            console.log("[bot-referral]", error.message);
            return false;
        });
        await ctx.reply(invited ? INVITED_PROMPT : PROMPT, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: PLAY_LABEL,
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
export { GAME_URL, PLAY_LABEL }


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
