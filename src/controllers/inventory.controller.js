import userService from "../services/user.service.js";
import craftingService from "../services/crafting.service.js";
import shopService from "../services/shop.service.js";
import { handle, sendServerError } from "../utils/http.js";

async function getFullUserInventory(req, res) {
    try {
        if (!req.tgUser) return res.status(401).json({ success: false, message: "Не вдалося підтвердити акаунт Telegram" })
        const userData = await userService.getFullUserInfoByTG(req.tgUser)
        return res.status(200).json({ success: true, message: "Data success", inventory: userData.inventory });
    } catch (error) {
        sendServerError(res, error)
    }
}

async function getClientCatalog(req, res) {
    try {
        const catalog = await craftingService.getClientCatalog()
        res.set("Cache-Control", "public, max-age=3600")
        return res.status(200).json({ success: true, ...catalog })
    } catch (error) {
        sendServerError(res, error)
    }
}

const buyItem = handle(req => shopService.buy(req.user, req.body?.slug, req.body?.quantity, req.body?.variant))
const sellItem = handle(req => shopService.sell(req.user, req.body?.stackId, req.body?.quantity))
const mergeStacks = handle(req => shopService.merge(req.user, req.body?.fromId, req.body?.toId))
const compactStacks = handle(req => shopService.compact(req.user))
const recycleStack = handle(req => shopService.recycle(req.user, req.body?.stackId, req.body?.quantity))

export { getFullUserInventory, getClientCatalog, buyItem, sellItem, mergeStacks, compactStacks, recycleStack }
