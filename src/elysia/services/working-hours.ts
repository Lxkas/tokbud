import { esClient } from "@/elysia/utils/es";
import { ES_IDX_TIME_RECORD, ES_IDX_OVERTIME_RECORD } from "@/elysia/utils/const";
import { TimeRecordDoc, OvertimeRecordDoc, WorkingHoursResponse } from "@/elysia/types/es";

export async function getWorkingHours(userId: string, date: string): Promise<WorkingHoursResponse> {
    try {
        // Get normal shift record
        const normalShiftResult = await esClient.search<TimeRecordDoc>({
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

        // Get overtime records
        const overtimeResult = await esClient.search<OvertimeRecordDoc>({
            index: ES_IDX_OVERTIME_RECORD,
            query: {
                bool: {
                    must: [
                        { term: { user_id: userId }},
                        { term: { date: date }}
                    ]
                }
            },
            sort: [
                { "start_time.system_time": { order: "asc" }}
            ]
        });

        // Prepare response
        const response: WorkingHoursResponse = {
            user_id: userId,
            overtime_shifts: []
        };

        // Add normal shift info if exists
        const totalNormalShifts = typeof normalShiftResult.hits.total === 'number' 
            ? normalShiftResult.hits.total 
            : normalShiftResult.hits.total?.value ?? 0;

        if (totalNormalShifts > 0 && normalShiftResult.hits.hits[0]?._source) {
            const normalShift = normalShiftResult.hits.hits[0];
            if (normalShift._id) {
                response.normal_shift = {
                    document_id: normalShift._id,
                    clock_in: normalShift._source?.clock_in ? {
                        time: normalShift._source.clock_in.system_time,
                        image_url: normalShift._source.clock_in.image_url
                    } : undefined,
                    clock_out: normalShift._source?.clock_out ? {
                        time: normalShift._source.clock_out.system_time,
                        image_url: normalShift._source.clock_out.image_url
                    } : undefined
                };
            }
        }

        // Add overtime shifts info
        const totalOvertimeShifts = typeof overtimeResult.hits.total === 'number' 
            ? overtimeResult.hits.total 
            : overtimeResult.hits.total?.value ?? 0;

        if (totalOvertimeShifts > 0) {
            response.overtime_shifts = overtimeResult.hits.hits
                .filter(hit => hit._id && hit._source)
                .map(hit => ({
                    document_id: hit._id!,
                    start_time: {
                        time: hit._source!.start_time.system_time,
                        image_url: hit._source!.start_time.image_url
                    },
                    end_time: hit._source!.end_time ? {
                        time: hit._source!.end_time.system_time,
                        image_url: hit._source!.end_time.image_url
                    } : undefined
                }));
        }

        return response;
    } catch (error) {
        console.error('Error getting working hours:', error);
        throw error;
    }
}