import userService from "../services/user.service.js";
import craftingService from "../services/crafting.service.js";

async function getFullUserInventory(req, res) {
    try {
        const tgUser = req.tgUser

        if (!tgUser) return res.status(400).json({ success: false, message: "TgUser is invalid" })

        const userData = await userService.getFullUserInfoByTG(tgUser)

        return res.status(200).json({
            success: true,
            message: "Data seccess",
            inventory: userData.inventory
        });

    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, message: error.message })
    }
}

async function getWorkbenchRecipes(req, res) {
    try {
        const recipes = await craftingService.getWorkbenchRecipes()
        return res.status(200).json({ success: true, recipes })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

async function craftWorkbenchItem(req, res) {
    try {
        if (!req.user) return res.status(400).json({ success: false, message: "Користувача не знайдено" })
        const result = await craftingService.craft(req.user._id, req.body?.recipeId, req.body?.items)
        return res.status(result.status).json(result)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: error.message })
    }
}


export { getFullUserInventory, getWorkbenchRecipes, craftWorkbenchItem }
