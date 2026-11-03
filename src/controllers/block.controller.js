import blockService from "../services/block.service.js";
import { handle } from "../utils/http.js";

const BLOCK_UNAVAILABLE = { success: false, message: "Цей блок недоступний", status: 400 };
// Slug каталогу: малі латинські літери, цифри й підкреслення
const SLUG = /^[a-z0-9_]{1,64}$/;

export const isSlug = value => typeof value === "string" && SLUG.test(value);

// POST /api/block/tap
const addTaps = handle(req => {
  const { slug, count } = req.body ?? {};
  if (!isSlug(slug)) return BLOCK_UNAVAILABLE;
  return blockService.addTaps(req.user._id, slug, count);
});

// POST /api/block/buy. Рядок перевіряється до запиту в базу: об'єкт замість slug знайшов би довільний блок
const buyBlock = handle(req => {
  const { slug } = req.body ?? {};
  if (!isSlug(slug)) return BLOCK_UNAVAILABLE;
  return blockService.buyBlock(slug, req.user._id, req.tgUser);
});

// GET /api/block/all
const getAllBlocks = handle(() => blockService.getAllBlocks(), { needsUser: false });

// GET /api/block/all-taps
const getBlocksToTap = handle(() => blockService.getBlocksToTap(), { needsUser: false });

// GET /api/block/:slug
const getBlockBySlug = handle(req => (isSlug(req.params.slug) ? blockService.getBlockBySlug(req.params.slug) : { ...BLOCK_UNAVAILABLE, status: 404 }), { needsUser: false });

const getFirst = handle(req => blockService.getFirst(req.user._id));

const getUserBlocks = handle(req => blockService.getUserBlocks(req.user._id));

export { addTaps, buyBlock, getAllBlocks, getBlockBySlug, getFirst, getUserBlocks, getBlocksToTap };
