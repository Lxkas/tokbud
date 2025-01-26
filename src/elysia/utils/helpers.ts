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
    endTimeInfo?: TimeInfo;
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
    const changeLog = {
        is_system: isSystem.toString(),
        timestamp: new Date().toISOString(),
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