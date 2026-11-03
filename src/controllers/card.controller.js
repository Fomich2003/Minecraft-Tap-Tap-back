import cardService from "../services/card.service.js";
import { handle } from "../utils/http.js";

const listCards = handle(req => cardService.list(req.user));
const setDeck = handle(req => cardService.setDeck(req.user, req.body?.deck));

export { listCards, setDeck };
