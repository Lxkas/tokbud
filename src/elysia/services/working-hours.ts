import { esClient } from "@/elysia/utils/es";
import { ES_IDX_TIME_RECORD } from "@/elysia/utils/const";

interface ChangeLogEntry {
    timestamp: string;
    shift_start_time: string;
    shift_end_time: string;
    clock_in_image_url?: string;
    clock_out_image_url?: string;
    shift_reason?: string;
    lat?: number;
    lon?: number;
    edit_reason: string;
    is_system: boolean;
}

// Helper function to safely parse JSON array
function parseChangeLogArray(jsonArray: string[] | undefined): ChangeLogEntry[] | null {
    if (!jsonArray || !Array.isArray(jsonArray)) return null;
    
    try {
        return jsonArray.map(jsonString => JSON.parse(jsonString) as ChangeLogEntry);
    } catch (error) {
        console.error('Error parsing change_log array:', error);
        return null;
    }
}

// Helper function to calculate hours between two timestamps
function calculateHours(startTime: string | undefined, endTime: string | undefined): number | null {
    if (!startTime || !endTime) return null;
    
    try {
        const start = new Date(startTime);
        const end = new Date(endTime);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return null;
        }

        const diffInMilliseconds = end.getTime() - start.getTime();
        const diffInHours = diffInMilliseconds / (1000 * 60 * 60);
        
        // Round to 2 decimal places
        return Math.round(diffInHours * 100) / 100;
    } catch (error) {
        console.error('Error calculating hours:', error);
        return null;
    }
}

interface TimeDetails {
    shift_time: string;
    timestamp: string;
    image_url?: string;
    lat?: number;
    lon?: number;
}

interface WorkingHour {
    date: string;
    doc_id: string;
    user_id: string;
    org_id: string;
    shift_type: string;
    status: string;
    reason?: string;
    start_time?: TimeDetails;
    end_time?: TimeDetails;
    change_log?: string[];
}

interface WorkingHourShift {
    doc_id: string;
    shift_type: string;
    status: string;
    reason?: string;
    start_time?: TimeDetails;
    end_time?: TimeDetails;
    change_log?: ChangeLogEntry[] | null;
    actual_hours: number | null;
    official_hours: number | null;
}

interface WorkingHoursByDate {
    date: string;
    shift: WorkingHourShift[];
}

interface WorkingHourResponse {
    status: string;
    data: {
        user_id: string;
        org_id: string;
        all_shift: WorkingHoursByDate[];
    }[];
}

export async function getWorkingHours(
    params: {
        user_id?: string;
        org_id?: string;
        start_date?: string;
        end_date?: string;
    }
): Promise<WorkingHourResponse> {
    const { user_id, org_id, start_date, end_date } = params;

    // Validate that at least one of user_id or org_id is provided
    if (!user_id && !org_id) {
        throw new Error("At least one of user_id or org_id must be specified");
    }

    try {
        // Build the query
        const mustClauses = [];

        // Add user_id and/or org_id conditions
        if (user_id) mustClauses.push({ term: { user_id } });
        if (org_id) mustClauses.push({ term: { org_id } });

        // Add date range conditions if provided
        if (start_date || end_date) {
            const rangeClause: any = { range: { date: {} } };
            if (start_date) rangeClause.range.date.gte = start_date;
            if (end_date) rangeClause.range.date.lte = end_date;
            mustClauses.push(rangeClause);
        }

        const result = await esClient.search<WorkingHour>({
            index: ES_IDX_TIME_RECORD,
            query: {
                bool: {
                    must: mustClauses
                }
            },
            sort: [
                { date: "asc" },
                { "start_time.timestamp": { order: "asc" } }
            ],
            size: 10000 // Adjust based on your needs
        });

        // Group results by user_id and date
        const groupedData = result.hits.hits.reduce((acc: { [key: string]: { [key: string]: WorkingHourShift[] } }, hit) => {
            if (!hit._source) return acc;
            
            const source = hit._source;
            const userId = source.user_id;
            const date = source.date;

            if (!acc[userId]) {
                acc[userId] = {};
            }
            if (!acc[userId][date]) {
                acc[userId][date] = [];
            }

            // Remove redundant fields that are already in parent objects
            const actual_hours = calculateHours(
                source.start_time?.timestamp,
                source.end_time?.timestamp
            );
            
            const official_hours = calculateHours(
                source.start_time?.shift_time,
                source.end_time?.shift_time
            );

            const shiftData: WorkingHourShift = {
                doc_id: hit._id as string,
                shift_type: source.shift_type,
                status: source.status,
                reason: source.reason,
                start_time: source.start_time,
                end_time: source.end_time,
                change_log: parseChangeLogArray(source.change_log),
                actual_hours,
                official_hours
            };
            
            acc[userId][date].push(shiftData);
            return acc;
        }, {});

        // Format the response
        const formattedData = Object.entries(groupedData).map(([userId, dateShifts]) => ({
            user_id: userId,
            org_id: result.hits.hits.find(hit => hit._source?.user_id === userId)?._source?.org_id || '',
            all_shift: Object.entries(dateShifts).map(([date, shifts]) => ({
                date,
                shift: shifts
            }))
        }));

        return {
            status: "ok",
            data: formattedData
        };

    } catch (error) {
        console.error('Error getting working hours:', error);
        throw error;
    }
}