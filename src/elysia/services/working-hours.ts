import { esClient } from "@/elysia/utils/es";
import { ES_IDX_TIME_RECORD } from "@/elysia/utils/const";
import { TimeRecordDoc, WorkingHoursResponse, WorkingHoursShift } from "@/elysia/types/es";

export async function getWorkingHours(userId: string, date: string | undefined): Promise<WorkingHoursResponse> {
    try {
        // Build query based on whether date is provided
        const query = {
            bool: {
                must: [
                    { term: { user_id: userId }},
                    ...(date ? [{ term: { date } }] : [])
                ]
            }
        };

        const result = await esClient.search<TimeRecordDoc>({
            index: ES_IDX_TIME_RECORD,
            query,
            sort: [
                { date: "asc" },  // First sort by date
                { shift_type: "asc" },  // Then sort regular shifts before overtime
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

        if (result.hits.hits.length > 0) {
            // Group shifts by date
            const shiftsByDate = result.hits.hits.reduce((acc: { [key: string]: WorkingHoursShift[] }, hit) => {
                if (!hit._source || !hit._id) return acc;

                const date = hit._source.date;
                if (!acc[date]) {
                    acc[date] = [];
                }

                const shift: WorkingHoursShift = {
                    document_id: hit._id,
                    shift_type: hit._source.shift_type,
                    ...(hit._source.shift_id && { shift_id: hit._source.shift_id }),
                    start_time: hit._source.shifts[0]?.start_time ? {
                        system_time: hit._source.shifts[0].start_time.system_time,
                        image_url: hit._source.shifts[0].start_time.image_url,
                        ...(hit._source.shifts[0].start_time.shift_time && {
                            shift_time: hit._source.shifts[0].start_time.shift_time
                        })
                    } : undefined,
                    end_time: hit._source.shifts[0]?.end_time ? {
                        system_time: hit._source.shifts[0].end_time.system_time,
                        image_url: hit._source.shifts[0].end_time.image_url,
                        ...(hit._source.shifts[0].end_time.shift_time && {
                            shift_time: hit._source.shifts[0].end_time.shift_time
                        })
                    } : undefined,
                    status: hit._source.status
                };

                // Add overtime_details only if it's an overtime shift
                if (hit._source.shift_type === 'overtime' && hit._source.overtime_details) {
                    shift.overtime_details = {
                        ...(hit._source.overtime_details.reason && { 
                            reason: hit._source.overtime_details.reason 
                        }),
                        ...(typeof hit._source.overtime_details.ot_hours !== 'undefined' && { 
                            ot_hours: hit._source.overtime_details.ot_hours 
                        })
                    };
                }

                acc[date].push(shift);
                return acc;
            }, {});

            // Convert the grouped shifts to array format
            response.shifts = Object.entries(shiftsByDate).map(([date, shifts]) => ({
                date,  // This is already UTC date from ES
                shift: shifts
            }));
        }

        return response;
    } catch (error) {
        console.error('Error getting working hours:', error);
        throw error;
    }
}