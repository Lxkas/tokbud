import Elysia, { error } from "elysia";
import { BaseClerkWebhook, ClerkOrganizationWebhook } from "@/elysia/types/clerk";
import { softDeleteOrganization, upsertOrganization } from "@/elysia/services/organization";
import { ClerkWebhookEvent } from "../utils/const";

export const webhookController = new Elysia({ prefix: "/webhook" }).post("/clerk", ({ body, set }) => {
	const webhook = body as BaseClerkWebhook<any>;
	switch (webhook.type) {
		case ClerkWebhookEvent.ORGANIZATION_CREATED:
		case ClerkWebhookEvent.ORGANIZATION_UPDATED:
			return upsertOrganization(webhook.data as ClerkOrganizationWebhook)
				.then(() => {
					set.status = webhook.type == ClerkWebhookEvent.ORGANIZATION_CREATED ? 201 : 200;
					return "Ok";
				})
				.catch((err) => {
					console.error(err);
					return error(500, "something wrong on our end while upserting org");
				});
		case ClerkWebhookEvent.ORGANIZATION_DELETED:
			return softDeleteOrganization(webhook.data as ClerkOrganizationWebhook).catch((err) => {
				console.error(err);
				return error(500, "something wrong on our end while deleting org");
			});
		default:
			return error(400, "unsupported event");
	}
});
