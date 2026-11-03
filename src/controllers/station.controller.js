import stationService from "../services/station.service.js";
import jobService from "../services/job.service.js";
import { handle } from "../utils/http.js";

// Тіло може бути порожнім (локальний тестовий вхід), тоді всі поля просто відсутні
const body = req => req.body ?? {};

const installBookshelves = handle(req => stationService.installBookshelves(req.user))
const listRecipes = handle(req => stationService.recipes(req.user))
const listStations = handle(req => stationService.list(req.user))
const buyStation = handle(req => stationService.buy(req.user, req.params.slug))
const activateStation = handle(req => stationService.activate(req.user, req.params.slug))
const previewStation = handle(req => stationService.preview(req.user, req.params.slug, body(req).slots, body(req).options))
const applyStation = handle(req => stationService.apply(req.user, req.params.slug, body(req).slots, body(req).options, body(req).times))
const jobStatus = handle(req => jobService.status(req.user, req.params.slug))
const previewCooking = handle(req => jobService.previewCooking(req.user, req.params.slug, body(req).slots))
const startCooking = handle(req => jobService.startCooking(req.user, req.params.slug, body(req).slots, body(req).quantity))
const startBrewing = handle(req => jobService.startBrewing(req.user, req.params.slug, body(req).slots))
const fillBottles = handle(req => jobService.fillBottles(req.user, req.params.slug, body(req).slots, body(req).count))
const collectJob = handle(req => jobService.collect(req.user, req.params.slug))
const cancelJob = handle(req => jobService.cancel(req.user, req.params.slug))

export {
    listStations, buyStation, activateStation, previewStation, applyStation, installBookshelves, listRecipes,
    jobStatus, previewCooking, startCooking, startBrewing, fillBottles, collectJob, cancelJob,
}
