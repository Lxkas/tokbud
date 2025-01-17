import Elysia, { error } from "elysia";
import { BaseClerkWebhook, ClerkOrganizationWebhook } from "@/elysia/types/clerk";
import { softDeleteOrganization, upsertOrganization } from "@/elysia/services/organization";
import { ClerkWebhookEvent } from "../utils/const";

export const webhookController = new Elysia({ prefix: "/webhook" }).post(
	"/clerk",
	({ body }: { body: { data: BaseClerkWebhook<any> } }) => {
		switch (body.data.type) {
			case ClerkWebhookEvent.ORGANIZATION_CREATED:
			case ClerkWebhookEvent.ORGANIZATION_UPDATED:
				upsertOrganization(body.data.data as ClerkOrganizationWebhook).catch((err) => {
					console.error(err);
					return error("Internal Server Error", "something wrong on our end while upserting org");
				});
				break;
			case ClerkWebhookEvent.ORGANIZATION_DELETED:
				softDeleteOrganization(body.data.data as ClerkOrganizationWebhook).catch((err) => {
					console.error(err);
					return error("Internal Server Error", "something wrong on our end while deleting org");
				});
				break;
			default:
				return error("Bad Request", "unsupported event");
		}
	},
);
