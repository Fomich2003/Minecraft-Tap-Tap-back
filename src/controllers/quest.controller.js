import questService from "../services/quest.service.js";
import { handle } from "../utils/http.js";

const listQuests = handle(req => questService.overview(req.user));
const claimQuest = handle(req => questService.claim(req.user, req.body?.id));

export { listQuests, claimQuest };
