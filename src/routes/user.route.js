import express from "express";
import { getUserProfile, claimUserAward, upgradeUserTap, getEquipment, equipTool, consumeItem, setUserLanguage, setProfileBanner, getLeaderboard } from "../controllers/user.controller.js";
import { checkTgProfile } from "../middlewares/verify.middleware.js";

const userRouter = express.Router();

// /api/user/profile
userRouter.post("/profile", checkTgProfile, getUserProfile);

// /api/user/claim-award
userRouter.post("/claim-award", checkTgProfile, claimUserAward);

// /api/user/upgrade
userRouter.post("/upgrade", checkTgProfile, upgradeUserTap);

// /api/user/equipment
userRouter.post("/equipment", checkTgProfile, getEquipment);

// /api/user/equip
userRouter.post("/equip", checkTgProfile, equipTool);

// /api/user/consume
userRouter.post("/consume", checkTgProfile, consumeItem);

// /api/user/banner
userRouter.post("/banner", checkTgProfile, setProfileBanner);

// /api/user/language
userRouter.post("/language", checkTgProfile, setUserLanguage);

// /api/user/leaderboard
userRouter.post("/leaderboard", checkTgProfile, getLeaderboard);

export default userRouter;