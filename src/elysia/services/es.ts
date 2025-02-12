import { esClient } from "@/elysia/utils/es";
import { TimeRecordDoc } from "@/elysia/types/time-record";
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
						{ term: { shift_type: "regular" } }, // Add filter for regular shifts
						{ term: { status: "incomplete" } }, // Only check incomplete shifts
					],
				},
			},
		});

		const totalHits = result.hits.total;
		const count = typeof totalHits === "number" ? totalHits : (totalHits?.value ?? 0);

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

export async function getActiveShifts(user_id: string, shift_type: "regular" | "overtime"): Promise<ActiveShift[]> {
	const result = await esClient.search<TimeRecordDoc>({
		index: ES_IDX_TIME_RECORD,
		query: {
			bool: {
				must: [{ term: { user_id } }, { term: { shift_type } }, { term: { status: "incomplete" } }],
			},
		},
	});

	return result.hits.hits
		.filter((hit) => hit._id && hit._source?.date)
		.map((hit) => ({
			document_id: hit._id!,
			date: hit._source!.date,
		}));
}

export async function getTodayRegularShift(user_id: string, date: string): Promise<ActiveShift | null> {
	const result = await esClient.search<TimeRecordDoc>({
		index: ES_IDX_TIME_RECORD,
		query: {
			bool: {
				must: [{ term: { user_id } }, { term: { date } }, { term: { shift_type: "regular" } }],
			},
		},
	});

	const hit = result.hits.hits[0];
	if (!hit || !hit._id || !hit._source?.date) {
		return null;
	}

	return {
		document_id: hit._id,
		date: hit._source.date,
	};
}












interface WorkingHoursQueryParams {
    user_ids: string[];
    start_date?: string;
    end_date?: string;
    sort_dates_ascending?: boolean;
}

interface WorkingHoursDoc {
    user_id: string;
    all_shift: {
        date: string;
        shift: Array<{
            is_complete: boolean;
            start_time: {
                timestamp: string;
            };
            end_time?: {
                timestamp: string;
            };
        }>;
    }[];
}

export async function getWorkingHoursData(params: WorkingHoursQueryParams) {
    try {
        // Construct base query
        const must: any[] = [
            {
                terms: {
                    user_id: params.user_ids
                }
            }
        ];

        // Add date range if provided
        if (params.start_date || params.end_date) {
            const range: any = {
                date: {}
            };
            if (params.start_date) {
                range.date.gte = params.start_date;
            }
            if (params.end_date) {
                range.date.lte = params.end_date;
            }
            must.push({
                range: range
            });
        }

        // Execute Elasticsearch query
        const result = await esClient.search<WorkingHoursDoc>({
            index: ES_IDX_TIME_RECORD,
            body: {
                query: {
                    bool: {
                        must: must
                    }
                },
                sort: params.sort_dates_ascending 
                    ? [{ date: { order: 'asc' } }]
                    : [{ date: { order: 'desc' } }],
                size: 10000 // Adjust based on your needs
            }
        });

        return {
            status: 'success',
            data: result.hits.hits.map(hit => hit._source)
        };
    } catch (error) {
        console.error("Error fetching working hours data:", error);
        throw error;
    }
}