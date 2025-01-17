import { ClerkWebhookEvent } from "@/elysia/utils/const";

export interface BaseClerkWebhook<T> {
	data: T;
	timestamp: Date;
	type: ClerkWebhookEvent;
}

export interface ClerkOrganizationWebhook {
	id: string;
	name: string;
	created_at: Date;
	updated_at: Date;
	deleted: boolean;
}
