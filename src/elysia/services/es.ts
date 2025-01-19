import { esClient } from "@/elysia/utils/es";
import { TimeRecordDoc } from "@/elysia/types/es";
import { ES_IDX_TIME_RECORD } from "@/elysia/utils/const";

interface ActiveShift {
    document_id: string;
    date: string;
}

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

export async function getActiveShifts(user_id: string, shift_type: 'regular' | 'overtime'): Promise<ActiveShift[]> {
    const result = await esClient.search<TimeRecordDoc>({
        index: ES_IDX_TIME_RECORD,
        query: {
            bool: {
                must: [
                    { term: { user_id } },
                    { term: { shift_type } },
                    { term: { status: 'incomplete' } }
                ]
            }
        }
    });

    return result.hits.hits
        .filter(hit => hit._id && hit._source?.date)
        .map(hit => ({
            document_id: hit._id!,
            date: hit._source!.date
        }));
}

export async function getTodayRegularShift(user_id: string, date: string): Promise<ActiveShift | null> {
    const result = await esClient.search<TimeRecordDoc>({
        index: ES_IDX_TIME_RECORD,
        query: {
            bool: {
                must: [
                    { term: { user_id } },
                    { term: { date } },
                    { term: { shift_type: 'regular' } }
                ]
            }
        }
    });

    const hit = result.hits.hits[0];
    if (!hit || !hit._id || !hit._source?.date) {
        return null;
    }

    return {
        document_id: hit._id,
        date: hit._source.date
    };
}
