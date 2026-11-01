import express from "express";
import { checkTgProfile } from "../middlewares/verify.middleware.js";
import { getFullUserInventory, getClientCatalog, buyItem, sellItem, mergeStacks, compactStacks, recycleStack } from "../controllers/inventory.controller.js";

const inventoryRouter = express.Router();

inventoryRouter.get("/catalog", getClientCatalog)
inventoryRouter.post("/full", checkTgProfile, getFullUserInventory)
inventoryRouter.post("/buy", checkTgProfile, buyItem)
inventoryRouter.post("/sell", checkTgProfile, sellItem)
inventoryRouter.post("/merge", checkTgProfile, mergeStacks)
inventoryRouter.post("/compact", checkTgProfile, compactStacks)
inventoryRouter.post("/recycle", checkTgProfile, recycleStack)

export default inventoryRouter;
