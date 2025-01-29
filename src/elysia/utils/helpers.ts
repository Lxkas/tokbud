import { TimeInfo } from "@/elysia/types/time-record";

export function isValidUTCDateTime(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    return regex.test(dateString) && !isNaN(Date.parse(dateString));
}

interface ChangeLogParams {
    isSystem: boolean;
    edit_reason: string;
    lat: number;
    lon: number;
    startTimeInfo: TimeInfo;
    endTimeInfo?: TimeInfo | null;
    shift_reason: string;
}

export function createChangeLogJSON({
    isSystem,
    edit_reason,
    lat,
    lon,
    startTimeInfo,
    endTimeInfo,
    shift_reason
}: ChangeLogParams): string {
    const currentTime = new Date().toISOString();
    const currentTimeUTC7 = convertToTimezone(currentTime, 7);

    const changeLog = {
        is_system: isSystem.toString(),
        timestamp: currentTimeUTC7,
        edit_reason: edit_reason || "",
        lat: lat,
        lon: lon,
        data: {
            shift_reason: shift_reason || "",
            start_time: {
                shift_time: startTimeInfo.shift_time,
                timestamp: startTimeInfo.timestamp,
                image_url: startTimeInfo.image_url,
                lat: startTimeInfo.lat,
                lon: startTimeInfo.lon,
            },
            end_time: endTimeInfo ? {
                shift_time: endTimeInfo.shift_time,
                timestamp: endTimeInfo.timestamp,
                image_url: endTimeInfo.image_url,
                lat: endTimeInfo.lat,
                lon: endTimeInfo.lon,
            } : {
                shift_time: "",
                timestamp: "",
                image_url: "",
                lat: 0,
                lon: 0,
            }
        }
    };

    return JSON.stringify(changeLog);
}

export function convertToTimezone(isoString: string, offsetHours: number): string {
    const date = new Date(isoString);
    const newDate = new Date(date.getTime() + (offsetHours * 60 * 60 * 1000));
    return newDate.toISOString();
}

export function isValidDateFormat(date: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(date)) return false;
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return false;
    
    return true;
}

export function formatDateTime(isoString: string): string {
    if (!isoString) return '(no time)';
    
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '(invalid time)';
        
        const day = date.getUTCDate().toString().padStart(2, '0');
        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const year = date.getUTCFullYear();
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
        return '(invalid time)';
    }
}

// Format time to HH:mm
// export function formatTime(date: Date): string {
//     return date.toTimeString().slice(0, 5);
// }
export function formatTime(date: Date): string {
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Create Date object
export function safeCreateDate(dateStr: string | undefined): Date | null {
    if (!dateStr) {
        return null;
    }
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}

// ฉalculate hours between two timestamps
export function calculateDuration(startTime: string | undefined, endTime: string | undefined): string | null {
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