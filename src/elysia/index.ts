import { Elysia } from "elysia";
import { distanceController } from "./controllers/distance";
import { webhookController } from "./controllers/webhook";
import { timeRecordController } from "./controllers/time-record";

export const elysiaApp = new Elysia({ prefix: "/api" })
	.get("/", () => "Hello Elysia")
	.use(distanceController)
	.use(webhookController)
	.use(timeRecordController);

export type ElysiaApp = typeof elysiaApp;
