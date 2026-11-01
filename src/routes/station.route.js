import express from "express";
import { checkTgProfile } from "../middlewares/verify.middleware.js";
import {
    listStations, buyStation, activateStation, previewStation, applyStation, installBookshelves, listRecipes,
    jobStatus, previewCooking, startCooking, startBrewing, fillBottles, collectJob, cancelJob,
} from "../controllers/station.controller.js";

const stationRouter = express.Router();

stationRouter.use(checkTgProfile);

stationRouter.post("/list", listStations);
stationRouter.post("/bookshelves", installBookshelves);
stationRouter.post("/recipes", listRecipes);
stationRouter.post("/:slug/buy", buyStation);
stationRouter.post("/:slug/activate", activateStation);
stationRouter.post("/:slug/preview", previewStation);
stationRouter.post("/:slug/apply", applyStation);
stationRouter.post("/:slug/job", jobStatus);
stationRouter.post("/:slug/cook-preview", previewCooking);
stationRouter.post("/:slug/cook", startCooking);
stationRouter.post("/:slug/brew", startBrewing);
stationRouter.post("/:slug/fill", fillBottles);
stationRouter.post("/:slug/collect", collectJob);
stationRouter.post("/:slug/cancel", cancelJob);

export default stationRouter;
