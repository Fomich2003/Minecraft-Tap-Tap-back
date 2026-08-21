import blockService from "../services/block.service.js";

async function addTaps(req, res) {
  try {

    if (!req.body) return res.status(400).json({ success: false, message: "Body is invalid" });

    if (!req.user) return res.status(400).json({ success: false, message: "User is invalid" });

    // Витягуємо з тіла запиту telegramId та slug предмета
    const { slug, count } = req.body;

    // Перевірка наявності slug предмета
    if (!slug)
      return res.status(400).json({ success: false, message: "Slug invalid" });

    const result = await blockService.addTaps(req.user._id, slug, count)

    // Повертаємо успішну відповідь з повідомленням
    return res.status(result.status).json(result);

  } catch (error) {
    // Виводимо помилку в консоль і повертаємо 500 статус сервера
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function buyBlock(req, res) {
  try {

    if (!req.body) return res.status(400).json({ success: false, message: "Body is invalid" });

    // Витягуємо з тіла запиту telegramId та slug предмета
    const { telegramId, slug } = req.body;

    // Перевірка наявності telegramId
    if (!telegramId)
      return res.status(400).json({ success: false, message: "TelegramId invalid" });

    // Перевірка наявності slug предмета
    if (!slug)
      return res.status(400).json({ success: false, message: "Slug invalid" });

    const result = await blockService.buyBlock(slug, telegramId)

    // Повертаємо успішну відповідь з повідомленням
    return res.status(result.status).json(result);

  } catch (error) {
    // Виводимо помилку в консоль і повертаємо 500 статус сервера
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/block/all
async function getAllBlocks(req, res) {
  try {

    const result = await blockService.getAllBlocks();
    res.status(result.status).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/block/all-taps
async function getBlocksToTap(req, res) {
  try {
    const result = await blockService.getBlocksToTap();
    res.status(result.status).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/block/:slug
async function getBlockBySlug(req, res) {
  try {

    if (!req.params) return res.status(400).json({ success: false, message: "Params is invalid" });

    const { slug } = req.params;
    if (!slug) return res.status(400).json({ success: false, message: "Slug invalid" });

    const result = await blockService.getBlockBySlug(slug);
    res.status(result.status).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getFirst(req, res) {
  try {

    if (!req.user) return res.status(400).json({ success: false, message: "User is invalid" });



    const result = await blockService.getFirst(req.user._id)
    console.log("[getFirst]", result)
    // Повертаємо успішну відповідь з повідомленням
    return res.status(result.status).json(result);

  } catch (error) {
    // Виводимо помилку в консоль і повертаємо 500 статус сервера
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getUserBlocks(req, res) {
  try {

    if (!req.user) return res.status(400).json({ success: false, message: "User is invalid" });



    const result = await blockService.getUserBlocks(req.user._id)

    // Повертаємо успішну відповідь з повідомленням
    return res.status(result.status).json(result);

  } catch (error) {
    // Виводимо помилку в консоль і повертаємо 500 статус сервера
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
}



export { addTaps, buyBlock, getAllBlocks, getBlockBySlug, getFirst, getUserBlocks, getBlocksToTap };
