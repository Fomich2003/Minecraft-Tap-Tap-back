import express from "express";
import { tapBlock, buyBlock, getAllBlocks, getBlockBySlug } from "../controllers/block.controller.js";

const blockRouter = express.Router();

// /api/block/tap 
blockRouter.post("/tap", tapBlock);

// /api/block/buy
blockRouter.post("/buy", buyBlock);

// /api/block/all
blockRouter.get("/all", getAllBlocks);
// /api/block/:slug
blockRouter.get("/:slug", getBlockBySlug);

export default blockRouter;





