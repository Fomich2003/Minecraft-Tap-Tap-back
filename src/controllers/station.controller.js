import stationService from "../services/station.service.js";
import jobService from "../services/job.service.js";

const handle = action => async (req, res) => {
    try {
        if (!req.user) return res.status(400).json({ success: false, message: "Користувача не знайдено" })
        const result = await action(req)
        return res.status(result.status).json(result)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: error.message })
    }
}

const listStations = handle(req => stationService.list(req.user))
const buyStation = handle(req => stationService.buy(req.user, req.params.slug))
const activateStation = handle(req => stationService.activate(req.user, req.params.slug))
const previewStation = handle(req => stationService.preview(req.user, req.params.slug, req.body.slots, req.body.options))
const applyStation = handle(req => stationService.apply(req.user, req.params.slug, req.body.slots, req.body.options))
const jobStatus = handle(req => jobService.status(req.user, req.params.slug))
const previewCooking = handle(req => jobService.previewCooking(req.user, req.params.slug, req.body.slots))
const startCooking = handle(req => jobService.startCooking(req.user, req.params.slug, req.body.slots, req.body.quantity))
const startBrewing = handle(req => jobService.startBrewing(req.user, req.params.slug, req.body.slots))
const collectJob = handle(req => jobService.collect(req.user, req.params.slug))
const cancelJob = handle(req => jobService.cancel(req.user, req.params.slug))

export {
    listStations, buyStation, activateStation, previewStation, applyStation,
    jobStatus, previewCooking, startCooking, startBrewing, collectJob, cancelJob,
}
