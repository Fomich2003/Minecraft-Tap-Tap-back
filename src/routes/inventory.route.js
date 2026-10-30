import express from "express";
import { checkTgProfile } from "../middlewares/verify.middleware.js";
import { getFullUserInventory, getClientCatalog, buyItem, sellItem } from "../controllers/inventory.controller.js";

const inventoryRouter = express.Router();

inventoryRouter.get("/catalog", getClientCatalog)
inventoryRouter.post("/full", checkTgProfile, getFullUserInventory)
inventoryRouter.post("/buy", checkTgProfile, buyItem)
inventoryRouter.post("/sell", checkTgProfile, sellItem)

export default inventoryRouter;
