import express from "express";
import { checkTgProfile } from "../middlewares/verify.middleware.js";
import { claimQuest, listQuests } from "../controllers/quest.controller.js";

const questRouter = express.Router();

questRouter.use(checkTgProfile);

// /api/quest/list
questRouter.post("/list", listQuests);

// /api/quest/claim
questRouter.post("/claim", claimQuest);

export default questRouter;
