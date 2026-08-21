import express from "express";
import { addTaps, buyBlock, getAllBlocks, getBlockBySlug, getFirst, getBlocksToTap, getUserBlocks } from "../controllers/block.controller.js";
import { checkTgProfile } from "../middlewares/verify.middleware.js";

const blockRouter = express.Router();

// /api/block/tap
blockRouter.post("/tap", checkTgProfile, addTaps);

// /api/block/buy
blockRouter.post("/buy", buyBlock);

// /api/block/all
blockRouter.get("/all", getAllBlocks);

// /api/block/all-taps
blockRouter.get("/all-taps", getBlocksToTap);

// /api/block/:slug
blockRouter.get("/:slug", getBlockBySlug);

// /api/block/get-first
blockRouter.post("/get-first", checkTgProfile, getFirst);

// /api/block/get-userblocks
blockRouter.post("/get-userblocks", checkTgProfile, getUserBlocks);

export default blockRouter;





