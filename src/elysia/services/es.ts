import { esClient } from "@/elysia/utils/es";
import { TimeRecordDoc } from "@/elysia/types/es";
import { ES_IDX_TIME_RECORD } from "@/elysia/utils/const";

export async function isDocumentExisted(userId: string, date: string) {
    try {
        const result = await esClient.search({
            index: ES_IDX_TIME_RECORD,
            query: {
                bool: {
                    must: [
                        { term: { user_id: userId } },
                        { term: { date: date } },
                        { term: { shift_type: 'regular' } },  // Add filter for regular shifts
                        { term: { status: 'incomplete' } }     // Only check incomplete shifts
                    ],
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

export async function getActiveOvertimeShifts(user_id: string): Promise<string[]> {
    const result = await esClient.search<TimeRecordDoc>({
        index: ES_IDX_TIME_RECORD,
        query: {
            bool: {
                must: [
                    { term: { user_id } },
                    { term: { shift_type: 'overtime' } },
                    { term: { status: 'incomplete' } }
                ]
            },
            // No date filter here, intentionally getting all dates
        }
    });

    // Filter out any undefined IDs and ensure we only return strings
    const activeShiftIds = result.hits.hits
        .map(hit => hit._id)
        .filter((id): id is string => id !== undefined);
        
    return activeShiftIds;
}

