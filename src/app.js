import express from "express";
import cors from "cors";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";

import blockRouter from "./routes/block.route.js";
import userRouter from "./routes/user.route.js";
import inventoryRouter from "./routes/inventory.route.js";
import stationRouter from "./routes/station.route.js";
import questRouter from "./routes/quest.route.js";
import mobRouter from "./routes/mob.route.js";
import cardRouter from "./routes/card.route.js";

import { corsOptions } from "./config/cors.config.js";
import { createRateLimiter, rejectUnsafeInput } from "./middlewares/security.middleware.js";
import { sendServerError } from "./utils/http.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Застосунок окремо від запуску: тести піднімають його без бота й без живої бази
export function createApp({ ipLimit = 600 } = {}) {
    const app = express();

    // ngrok приходить з localhost і передає адресу гравця в X-Forwarded-For: довіряємо лише локальному проксі
    app.set("trust proxy", "loopback");
    app.disable("x-powered-by");

    // Ліміт на адресу ловить грубий перебір ще до перевірки підпису
    const ipLimiter = createRateLimiter({ windowMs: 60 * 1000, max: ipLimit, keyOf: req => req.ip });

    app.use(compression());
    app.use((req, res, next) => {
        res.set("X-Content-Type-Options", "nosniff");
        res.set("Referrer-Policy", "no-referrer");
        next();
    });
    app.use(cors(corsOptions()));
    app.use("/api", ipLimiter);
    app.use(express.json({ limit: "32kb" }));
    app.use(rejectUnsafeInput);

    app.use("/items", express.static(path.join(__dirname, "assets/items")));

    app.get("/", (req, res) => {
        res.send("Backend Starts");
    });

    app.use("/api/block", blockRouter);
    app.use("/api/user", userRouter);
    app.use("/api/inventory", inventoryRouter);
    app.use("/api/station", stationRouter);
    app.use("/api/quest", questRouter);
    app.use("/api/mob", mobRouter);
    app.use("/api/card", cardRouter);

    app.use("/api", (req, res) => res.status(404).json({ success: false, message: "Некоректний запит" }));

    // Зламаний JSON чи завелике тіло: Express інакше віддає HTML зі стеком виклику
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        const status = error.status ?? error.statusCode;
        if (status >= 400 && status < 500) return res.status(status).json({ success: false, message: "Некоректний запит" });
        sendServerError(res, error);
    });

    app.ipLimiter = ipLimiter;
    return app;
}
