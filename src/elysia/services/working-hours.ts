import { esClient } from "@/elysia/utils/es";
import { ES_IDX_TIME_RECORD } from "@/elysia/utils/const";
import { TimeRecordDoc, WorkingHoursResponse } from "@/elysia/types/es";

export async function getWorkingHours(userId: string, date: string): Promise<WorkingHoursResponse> {
    try {
        const result = await esClient.search<TimeRecordDoc>({
            index: ES_IDX_TIME_RECORD,
            query: {
                bool: {
                    must: [
                        { term: { user_id: userId }},
                        { term: { date: date }}
                    ]
                }
            },
            sort: [
                { shift_type: "asc" },  // Sort regular shifts before overtime
                {
                    "shifts.start_time.system_time": { 
                        order: "asc",
                        nested: {
                            path: "shifts"
                        }
                    }
                }
            ]
        });

        const response: WorkingHoursResponse = {
            user_id: userId,
            shifts: []
        };

        const totalShifts = typeof result.hits.total === 'number' 
            ? result.hits.total 
            : result.hits.total?.value ?? 0;

        if (totalShifts > 0) {
            response.shifts = result.hits.hits
                .filter(hit => hit._id && hit._source)
                .map(hit => ({
                    document_id: hit._id!,
                    shift_type: hit._source!.shift_type,
                    shift_id: hit._source!.shift_id,
                    start_time: hit._source!.shifts[0]?.start_time ? {
                        time: hit._source!.shifts[0].start_time.system_time,
                        image_url: hit._source!.shifts[0].start_time.image_url
                    } : undefined,
                    end_time: hit._source!.shifts[0]?.end_time ? {
                        time: hit._source!.shifts[0].end_time.system_time,
                        image_url: hit._source!.shifts[0].end_time.image_url,
                        ...(hit._source!.shifts[0].end_time.shift_time && {
                            shift_time: hit._source!.shifts[0].end_time.shift_time
                        })
                    } : undefined,
                    overtime_details: hit._source!.shift_type === 'overtime' ? 
                        hit._source!.overtime_details : undefined,
                    status: hit._source!.status
                }));
        }

        return response;
    } catch (error) {
        console.error('Error getting working hours:', error);
        throw error;
    }
}