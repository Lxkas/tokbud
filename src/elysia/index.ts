import { Elysia } from "elysia";
import { distanceController } from "./controllers/distance";
import { webhookController } from "./controllers/webhook";

export const elysiaApp = new Elysia({ prefix: "/api" })
	.get("/", () => "Hello Elysia")
	.use(distanceController)
	.use(webhookController);

export type ElysiaApp = typeof elysiaApp;
