import express from "express";
import { Telegraf } from "telegraf";
import "dotenv/config"
export { default as User } from "./User.model.js";
export { default as Item } from "./Item.model.js";
export { default as Inventory } from "./Inventory.model.js";
export { default as Station } from "./Station.model.js";
export { default as Recipe } from "./Recipe.model.js";

const app = express()
const bot = new Telegraf(process.env.BOT_TOKEN)



app.get("/", (req, res) => { res.send("Backend Starts") })


bot.start((ctx) => {
    console.log(JSON.stringify(ctx.update.message.from, null, 2))
    console.log(JSON.stringify(ctx.update.message.chat, null, 2))
    ctx.reply('click', {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: '🚀 Open WebApp',
                    web_app: {
                        url: 'https://animal.fomka.online'
                    }
                }
            ]]
        }
    });
})


app.listen(process.env.PORT, () => {
    console.log("App was Running")
})

bot.launch()