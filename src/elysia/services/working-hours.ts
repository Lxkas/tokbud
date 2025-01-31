import { esClient } from "@/elysia/utils/es";
import { ES_IDX_TIME_RECORD } from "@/elysia/utils/const";
import { formatDateTime, formatTime, calculateDuration, convertToTimezone } from "@/elysia/utils/helpers"
import { 
    ChangeLogEntry,
    WorkingHour,
    WorkingHourResponse,
    WorkingHourShift,
    ExportedWorkingHourResponse,
    ExportedUserWorkingHour,
    ExportedShiftDetail,
    ExportedIncompleteShift
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



export async function getWorkingHours(
    params: {
        user_id?: string;
        org_id?: string;
        start_date?: string;
        end_date?: string;
        sort_dates_ascending?: boolean; // Default false for latest dates first
        sort_shifts_ascending?: boolean; // Default false for latest shifts first
    }
): Promise<WorkingHourResponse> {
    const { 
        user_id, 
        org_id, 
        start_date, 
        end_date,
        sort_dates_ascending = false,
        sort_shifts_ascending = false 
    } = params;

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
                { date: sort_dates_ascending ? "asc" : "desc" },
                { "start_time.shift_time": { order: sort_shifts_ascending ? "asc" : "desc" } }
            ],
            size: 10000
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
            // console.log(source.change_log)
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

        // Format the response with proper sorting
        const formattedData = Object.entries(groupedData).map(([userId, dateShifts]) => {
            // Sort the all_shift array based on dates
            const sortedShifts = Object.entries(dateShifts)
                .map(([date, shifts]) => ({
                    date,
                    // Sort the shifts within each date based on shift_time
                    shift: shifts.sort((a, b) => {
                        const timeA = new Date(a.start_time.shift_time!).getTime();
                        const timeB = new Date(b.start_time.shift_time!).getTime();
                        return sort_shifts_ascending ? timeA - timeB : timeB - timeA;
                    })
                }))
                .sort((a, b) => {
                    const dateA = new Date(a.date).getTime();
                    const dateB = new Date(b.date).getTime();
                    return sort_dates_ascending ? dateA - dateB : dateB - dateA;
                });

            return {
                user_id: userId,
                org_id: result.hits.hits.find(hit => hit._source?.user_id === userId)?._source?.org_id || '',
                all_shift: sortedShifts
            };
        });

        return {
            status: "ok",
            data: formattedData
        };

    } catch (error) {
        console.error('Error getting working hours:', error);
        throw error;
    }
}

function generateChangeDescription(currentLog: ChangeLogEntry, previousLog: ChangeLogEntry): string[] {
    const changes: string[] = [];
    const timestamp = formatDateTime(currentLog.timestamp);
    const prefix = `[${currentLog.edit_reason} @ ${timestamp}] `;
    
    // Compare shift reason
    if (currentLog.data.shift_reason !== previousLog.data.shift_reason) {
        changes.push(
            `${prefix}Shift reason was updated from '${previousLog.data.shift_reason}' to '${currentLog.data.shift_reason}'`
        );
    }
    
    // Compare start time
    if (currentLog.data.start_time?.shift_time !== previousLog.data.start_time?.shift_time) {
        changes.push(
            `${prefix}Shift start time was updated from ${formatDateTime(convertToTimezone(previousLog.data.start_time?.shift_time!, 7))} to ${formatDateTime(convertToTimezone(currentLog.data.start_time?.shift_time!, 7))}`
        );
    }
    
    // Compare start timestamp
    if (currentLog.data.start_time?.timestamp !== previousLog.data.start_time?.timestamp) {
        changes.push(
            `${prefix}Clock-in time was updated from ${formatDateTime(convertToTimezone(previousLog.data.start_time?.timestamp!, 7))} to ${formatDateTime(convertToTimezone(currentLog.data.start_time?.timestamp!, 7))}`
        );
    }
    
    // Compare end time
    if (currentLog.data.end_time?.shift_time !== previousLog.data.end_time?.shift_time) {
        changes.push(
            `${prefix}Shift end time was updated from ${formatDateTime(convertToTimezone(previousLog.data.end_time?.shift_time!, 7))} to ${formatDateTime(convertToTimezone(currentLog.data.end_time?.shift_time!, 7))}`
        );
    }
    
    // Compare end timestamp
    if (currentLog.data.end_time?.timestamp !== previousLog.data.end_time?.timestamp) {
        changes.push(
            `${prefix}Clock-out time was updated from ${formatDateTime(convertToTimezone(previousLog.data.end_time?.timestamp!, 7))} to ${formatDateTime(convertToTimezone(currentLog.data.end_time?.timestamp!, 7))}`
        );
    }
    
    // Compare start image
    if (currentLog.data.start_time!.image_url !== previousLog.data.start_time!.image_url) {
        changes.push(
            `${prefix}Clock-in image was updated`
        );
    }
    
    // Compare end image
    if (currentLog.data.end_time?.image_url !== previousLog.data.end_time?.image_url) {
        changes.push(
            `${prefix}Clock-out image was updated`
        );
    }
    
    return changes;
}

function isValidDateString(date: string | undefined): date is string {
    return typeof date === 'string' && date.length > 0;
}

export async function getWorkingHoursExporter(
    params: {
        user_id?: string;
        org_id?: string;
        start_date?: string;
        end_date?: string;
        sort_dates_ascending?: boolean;
        sort_shifts_ascending?: boolean;
    }
): Promise<ExportedWorkingHourResponse> {
    const originalResponse = await getWorkingHours(params);
    
    const exportedData: ExportedUserWorkingHour[] = originalResponse.data.map((userData) => {
        return {
            user_id: userData.user_id,
            org_id: userData.org_id,
            all_shift: userData.all_shift.map((dayShift) => {
                const shiftsByType: { [key: string]: (ExportedShiftDetail | ExportedIncompleteShift)[] } = {};
                
                dayShift.shift.forEach((shiftDetail) => {
                    // Check if shift is complete
                    if (!shiftDetail.is_complete) {
                        // Handle incomplete shift
                        const incompleteShift: ExportedIncompleteShift = {
                            doc_id: shiftDetail.doc_id,
                            message: "This shift is incomplete and cannot be calculated for summary"
                        };

                        // Initialize array for this shift type if it doesn't exist
                        if (!shiftsByType[shiftDetail.shift_type]) {
                            shiftsByType[shiftDetail.shift_type] = [];
                        }
                        shiftsByType[shiftDetail.shift_type].push(incompleteShift);
                        return; // Skip the rest of the processing for this shift
                    }

                    // Process complete shift
                    const changeHistory: string[] = [];
                    var changes = [];
                    
                    shiftDetail.change_log!.forEach((log, index) => {
                        if (!log.is_system && index > 0) {
                            const previousLog = shiftDetail.change_log![index - 1];
                            changes = generateChangeDescription(log, previousLog);
                            changeHistory.push(...changes);
                        }
                    });
                    
                    const start = isValidDateString(shiftDetail.start_time.timestamp) 
                        ? formatTime(new Date(convertToTimezone(shiftDetail.start_time.timestamp, 7)))
                        : "00:00";

                    const end = isValidDateString(shiftDetail.end_time!.timestamp)
                        ? formatTime(new Date(convertToTimezone(shiftDetail.end_time!.timestamp, 7)))
                        : "00:00";
                    
                    const startOfficial = isValidDateString(shiftDetail.start_time.shift_time)
                        ? formatTime(new Date(convertToTimezone(shiftDetail.start_time.shift_time, 7)))
                        : "00:00";
                    
                    const endOfficial = isValidDateString(shiftDetail.end_time!.shift_time)
                        ? formatTime(new Date(convertToTimezone(shiftDetail.end_time!.shift_time, 7)))
                        : "00:00";
                    
                    const shiftData: ExportedShiftDetail = {
                        doc_id: shiftDetail.doc_id,
                        start,
                        end,
                        start_official: startOfficial,
                        end_official: endOfficial,
                        duration: calculateDuration(shiftDetail.start_time.timestamp, shiftDetail.end_time!.timestamp) || "00:00",
                        duration_official: calculateDuration(shiftDetail.start_time.shift_time, shiftDetail.end_time!.shift_time) || "00:00",
                        reason: shiftDetail.reason || "No reason provided", // Added reason with fallback
                        change_history: changeHistory
                    };

                    // Group by shift type
                    if (!shiftsByType[shiftDetail.shift_type]) {
                        shiftsByType[shiftDetail.shift_type] = [];
                    }
                    shiftsByType[shiftDetail.shift_type].push(shiftData);
                });
                
                return {
                    date: dayShift.date,
                    ...shiftsByType
                };
            })
        };
    });
    
    return {
        status: originalResponse.status,
        data: exportedData
    };
}