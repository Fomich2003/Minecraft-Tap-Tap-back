import { SERVER_CONF } from "../../config/server.config.js";

async function startCMD(ctx) {
    try {
        ctx.reply("click", {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: `Open WebApp`,
                            web_app: {
                                url: "https://tap-tap.fomka.online/"
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