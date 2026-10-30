import express from "express";
import { checkTgProfile } from "../middlewares/verify.middleware.js";
import { getFullUserInventory, getWorkbenchRecipes, craftWorkbenchItem } from "../controllers/inventory.controller.js";

const inventoryRouter = express.Router();

inventoryRouter.post("/full", checkTgProfile, getFullUserInventory)
inventoryRouter.post("/workbench", checkTgProfile, getWorkbenchRecipes)
inventoryRouter.post("/craft", checkTgProfile, craftWorkbenchItem)

export default inventoryRouter;
