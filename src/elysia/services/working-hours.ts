import { esClient } from "@/elysia/utils/es";
import { ES_IDX_TIME_RECORD } from "@/elysia/utils/const";
import { 
    ChangeLogEntry,
    WorkingHour,
    WorkingHourResponse,
    WorkingHourShift 
} from "@/elysia/types/working-hours";

// Helper function to safely parse JSON array
function parseChangeLogArray(jsonArray: string[] | undefined): ChangeLogEntry[] | null {
    if (!jsonArray || !Array.isArray(jsonArray)) return null;
    
    try {
        // console.log(jsonArray)
        return jsonArray.map(jsonString => {
            const parsedLog = JSON.parse(jsonString);
            
            // Validate the parsed data has the required structure
            if (!parsedLog.timestamp || !parsedLog.edit_reason || !parsedLog.data) {
                throw new Error('Invalid change log entry structure');
            }
            
            // Ensure is_system is properly handled regardless of string or boolean input
            const changeLogEntry: ChangeLogEntry = {
                ...parsedLog,
                is_system: typeof parsedLog.is_system === 'string' 
                    ? parsedLog.is_system.toLowerCase() === 'true'
                    : !!parsedLog.is_system
            };
            
            return changeLogEntry;
        });
    } catch (error) {
        console.error('Error parsing change_log array:', error);
        return null;
    }
}

// Helper function to calculate hours between two timestamps
function calculateDuration(startTime: string | undefined, endTime: string | undefined): string | null {
    if (!startTime || !endTime) return null;
    
    try {
        const start = new Date(startTime);
        const end = new Date(endTime);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return null;
        }

        const diffInMilliseconds = end.getTime() - start.getTime();
        
        // Calculate hours, minutes, and seconds
        const hours = Math.floor(diffInMilliseconds / (1000 * 60 * 60));
        const minutes = Math.floor((diffInMilliseconds % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffInMilliseconds % (1000 * 60)) / 1000);
        
        // Pad with leading zeros if needed
        const formattedHours = hours.toString().padStart(2, '0');
        const formattedMinutes = minutes.toString().padStart(2, '0');
        const formattedSeconds = seconds.toString().padStart(2, '0');
        
        // Return in format HH:MM:SS
        return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    } catch (error) {
        console.error('Error calculating duration:', error);
        return null;
    }
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
            const actual_hours = calculateDuration(
                source.start_time?.timestamp,
                source.end_time?.timestamp
            );
            
            const official_hours = calculateDuration(
                source.start_time?.shift_time,
                source.end_time?.shift_time
            );
            console.log(source.change_log)
            const shiftData: WorkingHourShift = {
                doc_id: hit._id as string,
                shift_type: source.shift_type,
                is_complete: source.is_complete,
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