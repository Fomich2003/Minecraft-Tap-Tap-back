import mobService from "../services/mob.service.js";
import { handle } from "../utils/http.js";

const listMobs = handle(async req => mobService.list(req.user));
const buyMob = handle(req => mobService.buy(req.user, req.body?.slug));
const summonBoss = handle(req => mobService.summon(req.user, req.body?.slug));
const hitMob = handle(req => mobService.hit(req.user._id, req.body?.slug, req.body?.count));

export { listMobs, buyMob, summonBoss, hitMob };
