import { esClient } from "@/elysia/utils/es";
import { ES_IDX_TIME_RECORD } from "@/elysia/utils/const";

export async function isDocumentExisted(userId: string, date: string) {
	try {
		const result = await esClient.search({
			index: ES_IDX_TIME_RECORD,
			query: {
				bool: {
					must: [{ term: { user_id: userId } }, { term: { date: date } }],
				},
			},
		});

		const totalHits = result.hits.total;
		const count = typeof totalHits === "number" ? totalHits : totalHits?.value ?? 0;

		if (count > 0 && result.hits.hits[0]?._id) {
			return {
				document_id: result.hits.hits[0]._id,
				existed: true,
			};
		}

		return {
			document_id: "",
			existed: false,
		};
	} catch (error) {
		console.error("Error checking document existence:", error);
		throw error;
	}
}
