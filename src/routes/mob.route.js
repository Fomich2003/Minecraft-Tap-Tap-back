import express from "express";
import { checkTgProfile } from "../middlewares/verify.middleware.js";
import { buyMob, hitMob, listMobs, summonBoss } from "../controllers/mob.controller.js";

const mobRouter = express.Router();

mobRouter.use(checkTgProfile);

// /api/mob/list
mobRouter.post("/list", listMobs);

// /api/mob/buy
mobRouter.post("/buy", buyMob);

// /api/mob/summon
mobRouter.post("/summon", summonBoss);

// /api/mob/hit
mobRouter.post("/hit", hitMob);

export default mobRouter;
