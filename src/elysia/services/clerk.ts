import { clerkClient } from "@/elysia/utils/clerk";
import { esClient } from "@/elysia/utils/es";
import { ES_IDX_TIME_RECORD } from "@/elysia/utils/const";

export async function getUserOrganization(userId: string) {
    try {
        const response = await clerkClient.users.getOrganizationMembershipList({
            userId: userId,
			// userId: "user_2riGJ090dbQNR41ccdBjkzvA3f6",
			// userId: "user_2rkKh0dgkzfzB3taTyy1KsRxorW",
			// userId: "user_2rkKhy9VF2JziL7q4OgH5f7T85y",
        });
        return response.data;
    } catch (error) {
        // Check if it's a Clerk API error
        if (error instanceof Error && error.message === 'Not Found') {
            throw new Error('Could not find organization for this user');
        }
        // Re-throw other unexpected errors
        throw error;
    }
}


export async function isDocumentExisted(userId: string, date: string) {
    try {
        const result = await esClient.search({
            index: ES_IDX_TIME_RECORD,
            query: {
                bool: {
                    must: [
                        { term: { user_id: userId }},
                        { term: { date: date }}
                    ]
                }
            }
        });

        const totalHits = result.hits.total;
        const count = typeof totalHits === 'number' ? totalHits : totalHits?.value ?? 0;

        if (count > 0 && result.hits.hits[0]?._id) {
            return {
                document_id: result.hits.hits[0]._id,
                existed: true
            };
        }

        return {
            document_id: "",
            existed: false
        };
    } catch (error) {
        console.error('Error checking document existence:', error);
        throw error;
    }
}