import userService from "../services/user.service.js";
import craftingService from "../services/crafting.service.js";
import shopService from "../services/shop.service.js";

async function getFullUserInventory(req, res) {
    try {
        const tgUser = req.tgUser

        if (!tgUser) return res.status(400).json({ success: false, message: "Не вдалося підтвердити акаунт Telegram" })

        const userData = await userService.getFullUserInfoByTG(tgUser)

        return res.status(200).json({
            success: true,
            message: "Data success",
            inventory: userData.inventory
        });

    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, message: error.message })
    }
}

async function getClientCatalog(req, res) {
    try {
        const catalog = await craftingService.getClientCatalog()
        res.set("Cache-Control", "public, max-age=3600")
        return res.status(200).json({ success: true, ...catalog })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

async function buyItem(req, res) {
    try {
        if (!req.user) return res.status(400).json({ success: false, message: "Користувача не знайдено" })
        const result = await shopService.buy(req.user, req.body?.slug, req.body?.quantity, req.body?.variant)
        return res.status(result.status).json(result)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

async function sellItem(req, res) {
    try {
        if (!req.user) return res.status(400).json({ success: false, message: "Користувача не знайдено" })
        const result = await shopService.sell(req.user, req.body?.stackId, req.body?.quantity)
        return res.status(result.status).json(result)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

async function mergeStacks(req, res) {
    try {
        if (!req.user) return res.status(400).json({ success: false, message: "Користувача не знайдено" })
        const result = await shopService.merge(req.user, req.body?.fromId, req.body?.toId)
        return res.status(result.status).json(result)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

async function compactStacks(req, res) {
    try {
        if (!req.user) return res.status(400).json({ success: false, message: "Користувача не знайдено" })
        const result = await shopService.compact(req.user)
        return res.status(result.status).json(result)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

async function recycleStack(req, res) {
    try {
        if (!req.user) return res.status(400).json({ success: false, message: "Користувача не знайдено" })
        const result = await shopService.recycle(req.user, req.body?.stackId, req.body?.quantity)
        return res.status(result.status).json(result)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

export { getFullUserInventory, getClientCatalog, buyItem, sellItem, mergeStacks, compactStacks, recycleStack }
