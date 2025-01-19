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
                { shift_type: "asc" },
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
                .map(hit => {
                    const shift = {
                        document_id: hit._id!,
                        shift_type: hit._source!.shift_type,
                        ...(hit._source!.shift_id && { shift_id: hit._source!.shift_id }),
                        start_time: hit._source!.shifts[0]?.start_time ? {
                            system_time: hit._source!.shifts[0].start_time.system_time,
                            image_url: hit._source!.shifts[0].start_time.image_url,
                            ...(hit._source!.shifts[0].start_time.shift_time && {
                                shift_time: hit._source!.shifts[0].start_time.shift_time
                            })
                        } : undefined,
                        end_time: hit._source!.shifts[0]?.end_time ? {
                            system_time: hit._source!.shifts[0].end_time.system_time,
                            image_url: hit._source!.shifts[0].end_time.image_url,
                            ...(hit._source!.shifts[0].end_time.shift_time && {
                                shift_time: hit._source!.shifts[0].end_time.shift_time
                            })
                        } : undefined,
                        status: hit._source!.status
                    } as any;  // Using any temporarily to build the object

                    // Add overtime_details only if it's an overtime shift
                    if (hit._source!.shift_type === 'overtime' && hit._source!.overtime_details) {
                        shift.overtime_details = {
                            ...(hit._source!.overtime_details.reason && { 
                                reason: hit._source!.overtime_details.reason 
                            }),
                            ...(typeof hit._source!.overtime_details.ot_hours !== 'undefined' && { 
                                ot_hours: hit._source!.overtime_details.ot_hours 
                            })
                        };
                    }

                    return shift;
                });
        }

        return response;
    } catch (error) {
        console.error('Error getting working hours:', error);
        throw error;
    }
}