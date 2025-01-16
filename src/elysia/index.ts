import { Elysia } from "elysia";
import { ClerkOrganizationWebhook } from "./types/clerk";
import { syncOrganizations } from "./organization/clerk";
import { esClient } from "./utils/es";

export const elysiaApp = new Elysia({ prefix: "/api" })
	.get("/", () => "Hello Elysia")
	.get("/health", async () => {
		try {
			const health = await esClient.cluster.health();
			return { status: "ok", elasticsearch: health };
		} catch (error) {
			return {
				status: "error",
				message: error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	})
	.post("/webhook/clerk", ({ body }: { body: ClerkOrganizationWebhook }) => {
		syncOrganizations(body);
	});

export type ElysiaApp = typeof elysiaApp;
