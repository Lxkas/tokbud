import { ClerkOrganizationWebhook } from "@/elysia/types/clerk";
import { esClient } from "@/elysia/utils/es";
import { ES_IDX_ORGANIZATION } from "@/elysia/utils/const";
import { OrganizationDoc } from "@/elysia/types/es";

export async function upsertOrganization(organizationWebhookPayload: ClerkOrganizationWebhook): Promise<void> {
	const orgDoc: OrganizationDoc = {
		id: organizationWebhookPayload.id,
		code: "",
		name: organizationWebhookPayload.name,
		updated_at: new Date(),
	};

	try {
		await esClient.index({
			index: ES_IDX_ORGANIZATION,
			id: organizationWebhookPayload.id,
			document: orgDoc,
		});
	} catch (e) {
		throw e;
	}
}

export async function softDeleteOrganization(organizationWebhookPayload: ClerkOrganizationWebhook): Promise<void> {
	try {
		if (!organizationWebhookPayload.deleted) {
			return;
		}

		await esClient.update({
			index: ES_IDX_ORGANIZATION,
			id: organizationWebhookPayload.id,
			doc: {
				deleted_at: new Date(),
			},
		});
	} catch (e) {
		throw e;
	}
}
