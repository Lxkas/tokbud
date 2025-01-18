import Elysia from "elysia";
import { TimeRecordDoc } from "@/elysia/types/es";
import { esClient } from "@/elysia/utils/es";
import { getUserOrganization } from "@/elysia/services/clerk";
import { ES_IDX_TIME_RECORD } from "@/elysia/utils/const";
import { isDocumentExisted } from "@/elysia/services/es";
import { jwtMiddleware } from "@/middleware";

interface TimeRecordBody {
	user_id: string;
	img_url: string;
	shift_time?: string;
}

export const timeRecordController = new Elysia({ prefix: "/time-record" })
	.use(jwtMiddleware)
	.post("/clock-in", async ({ body, jwt }) => {
		try {
			const { user_id, img_url, shift_time } = body as TimeRecordBody;

			// Validate required fields
			if (!user_id || !img_url) {
				return {
					status: "error",
					message: "Missing required fields: user_id and img_url are required",
				};
			}

			// Get current date for checking and document creation
			const now = new Date();
			const currentDate = now.toISOString().split("T")[0];

			// Check if user has already clocked in today
			const existingRecord = await isDocumentExisted(user_id, currentDate);

			if (existingRecord.existed) {
				return {
					status: "error",
					message: "You have already clocked in today",
					data: {
						document_id: existingRecord.document_id,
					},
				};
			}

			// Get organization info from Clerk
			const clerkResponse = await getUserOrganization(user_id);
			if (!clerkResponse || !clerkResponse[0]?.organization?.id) {
				return {
					status: "error",
					message: "Could not find organization for this user",
				};
			}

			const orgId = clerkResponse[0].organization.id;

			const timeRecordDoc: TimeRecordDoc = {
				user_id,
				date: currentDate,
				organization_id: orgId,
				clock_in: {
					system_time: now.toISOString(),
					image_url: img_url,
				},
				status: "incomplete",
			};

			// Add shift_time if provided
			if (shift_time) {
				timeRecordDoc.clock_in!.shift_time = shift_time;
			}

			// Index the document
			const result = await esClient.index({
				index: ES_IDX_TIME_RECORD,
				document: timeRecordDoc,
			});

			return {
				status: "ok",
				data: {
					document_id: result._id,
				},
			};
		} catch (error) {
			return {
				status: "error",
				message: error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	})
	.post("/clock-out", async ({ body }: { body: TimeRecordBody }) => {
		try {
			const { user_id, img_url, shift_time } = body;

			// Validate required fields
			if (!user_id || !img_url) {
				return {
					status: "error",
					message: "Missing required fields: user_id and img_url are required",
				};
			}

			// Check if document exists for today
			const currentDate = new Date().toISOString().split("T")[0];

			// Validate user exists in Clerk
			const clerkResponse = await getUserOrganization(user_id);
			if (!clerkResponse || !clerkResponse[0]?.organization?.id) {
				return {
					status: "error",
					message: "Could not find organization for this user",
				};
			}

			const docExists = await isDocumentExisted(user_id, currentDate);

			if (!docExists.existed) {
				return {
					status: "error",
					message: "No clock-in record found for today",
				};
			}

			// Get the existing record to check if already clocked out
			const existingRecord = await esClient.get({
				index: ES_IDX_TIME_RECORD,
				id: docExists.document_id,
			});

			if (existingRecord._source && (existingRecord._source as TimeRecordDoc).status === "complete") {
				return {
					status: "error",
					message: "You have already clocked out today",
					data: {
						document_id: docExists.document_id,
					},
				};
			}

			// Prepare update document
			const now = new Date();
			const updateDoc: any = {
				clock_out: {
					system_time: now.toISOString(),
					image_url: img_url,
				},
				status: "complete",
			};

			// Add shift_time if provided
			if (shift_time) {
				updateDoc.clock_out.shift_time = shift_time;
			}

			// Verify document_id exists and update the document
			if (!docExists.document_id) {
				return {
					status: "error",
					message: "Invalid document ID",
				};
			}

			await esClient.update({
				index: ES_IDX_TIME_RECORD,
				id: docExists.document_id,
				doc: updateDoc,
			});

			return {
				status: "ok",
				data: {
					document_id: docExists.document_id,
				},
			};
		} catch (error) {
			return {
				status: "error",
				message: error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	});
