import Elysia from "elysia";
import { ClerkOrganizationWebhook } from "@/elysia/types/clerk";
import { syncOrganizations } from "@/elysia/services/organization";

export const webhookController = new Elysia({ prefix: "/webhook" }).post(
	"/clerk",
	({ body }: { body: { data: ClerkOrganizationWebhook } }) => {
		syncOrganizations(body.data);
	},
);
