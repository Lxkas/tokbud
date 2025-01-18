import { Elysia } from "elysia";
import { distanceController } from "./controllers/distance";
import { webhookController } from "./controllers/webhook";
import { timeRecordController } from "./controllers/time-record";
import { overtimeController } from "./controllers/overtime-record";
import { workingHoursController } from "./controllers/working-hours";

export const elysiaApp = new Elysia({ prefix: "/api" })
	.get("/", () => "Hello Elysia")
	.use(distanceController)
	.use(webhookController)
	.use(timeRecordController)
	.use(overtimeController)
	.use(workingHoursController);

export type ElysiaApp = typeof elysiaApp;
