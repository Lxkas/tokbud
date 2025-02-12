import { TimeInfo } from "@/elysia/types/time-record";
import { UserResponse, WorkingHoursSummaryRequest } from "@/elysia/types/working-hours";

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

export function transformUserData(user: any): UserResponse {
    // Helper function to check if a value is empty
    const isEmpty = (value: any) => value === null || value === undefined || value === '';

    // Get first organization if exists
    const organization = user.organizations?.[0]?.organization;
    const publicUserData = user.organizations?.[0]?.publicUserData;

    // Get email with priority
    const email = !isEmpty(publicUserData?.identifier) ? publicUserData.identifier :
                 !isEmpty(user.emailAddresses?.[0]?.emailAddress) ? user.emailAddresses[0].emailAddress :
                 !isEmpty(user.externalAccounts?.[0]?.emailAddress) ? user.externalAccounts[0].emailAddress :
                 null;

    // Get first name with priority
    const firstName = !isEmpty(publicUserData?.firstName) ? publicUserData.firstName :
                     !isEmpty(user.firstName) ? user.firstName :
                     !isEmpty(user.externalAccounts?.[0]?.firstName) ? user.externalAccounts[0].firstName :
                     null;

    // Get last name with priority
    const lastName = !isEmpty(publicUserData?.lastName) ? publicUserData.lastName :
                    !isEmpty(user.lastName) ? user.lastName :
                    !isEmpty(user.externalAccounts?.[0]?.lastName) ? user.externalAccounts[0].lastName :
                    null;

    // Get image with priority
    const img = !isEmpty(publicUserData?.imageUrl) ? publicUserData.imageUrl :
                !isEmpty(user.imageUrl) ? user.imageUrl :
                !isEmpty(user.externalAccounts?.[0]?.imageUrl) ? user.externalAccounts[0].imageUrl :
                null;

    // Get position with priority
    const position = !isEmpty(user.publicMetadata?.department) ? user.publicMetadata.department :
                    !isEmpty(organization?.publicMetadata?.department) ? organization.publicMetadata.department :
                    null;

    return {
        user_id: user.id,
        employee_id: user.publicMetadata?.employee_id || null,
        img,
        first_name: firstName,
        last_name: lastName,
        email,
        branch_id: organization?.id || null,
        branch_name: organization?.name || null,
        position
    };
}

export function validateRequest(body: WorkingHoursSummaryRequest): string | null {
    if (!body.user_ids || !Array.isArray(body.user_ids)) {
        return "user_ids must be an array";
    }

    if (body.user_ids.length === 0) {
        return "user_ids array cannot be empty";
    }

    if (body.user_ids.some(id => typeof id !== 'string' || !id)) {
        return "all user_ids must be non-empty strings";
    }

    if (body.start_date && !isValidDateFormat(body.start_date)) {
        return "start_date must be in YYYY-MM-DD format";
    }

    if (body.end_date && !isValidDateFormat(body.end_date)) {
        return "end_date must be in YYYY-MM-DD format";
    }

    if (body.start_date && body.end_date) {
        const start = new Date(body.start_date);
        const end = new Date(body.end_date);
        if (start > end) {
            return "start_date cannot be later than end_date";
        }
    }

    return null;
}