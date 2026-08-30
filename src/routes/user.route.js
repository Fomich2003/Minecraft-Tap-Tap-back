import express from "express";
import { getUserProfile, claimUserAward } from "../controllers/user.controller.js";
import { checkTgProfile } from "../middlewares/verify.middleware.js";

const userRouter = express.Router();

// /api/user/profile
userRouter.post("/profile", checkTgProfile, getUserProfile);

// /api/user/claim-award
userRouter.post("/claim-award", checkTgProfile, claimUserAward);

export default userRouter;