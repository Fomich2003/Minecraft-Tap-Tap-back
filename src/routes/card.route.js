import express from "express";
import { checkTgProfile } from "../middlewares/verify.middleware.js";
import { listCards, setDeck } from "../controllers/card.controller.js";

const cardRouter = express.Router();

cardRouter.use(checkTgProfile);

// /api/card/list
cardRouter.post("/list", listCards);

// /api/card/deck
cardRouter.post("/deck", setDeck);

export default cardRouter;
