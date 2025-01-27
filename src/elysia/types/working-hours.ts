// For service
export interface TimeDetails {
    shift_time: string;
    timestamp: string;
    image_url: string;
    lat: number;
    lon: number;
}

export interface ChangeLogEntry {
    is_system: string | boolean;
    timestamp: string;
    edit_reason: string;
    lat: number;
    lon: number;
    data: {
        shift_reason: string;
        start_time: TimeDetails;
        end_time: TimeDetails | null;
    };
}

export interface WorkingHour {
    date: string;
    doc_id: string;
    user_id: string;
    org_id: string;
    shift_type: string;
    is_complete: boolean;
    reason: string;
    start_time: TimeDetails;
    end_time: TimeDetails | null;
    change_log?: string[];
}

export interface WorkingHourShift {
    doc_id: string;
    shift_type: string;
    is_complete: boolean;
    reason: string;
    start_time: TimeDetails;
    end_time: TimeDetails | null;
    change_log?: ChangeLogEntry[] | null;
    actual_hours: string | null;
    official_hours: string | null;
}

export interface WorkingHoursByDate {
    date: string;
    shift: WorkingHourShift[];
}

export interface WorkingHourResponse {
    status: string;
    data: {
        user_id: string;
        org_id: string;
        all_shift: WorkingHoursByDate[];
    }[];
}

// For controller
export interface WorkingHoursQuery {
    user_id?: string;
    org_id?: string;
    start_date?: string;
    end_date?: string;
    sort_dates_ascending?: string;
    sort_shifts_ascending?: string;
}

export interface JWTPayload {
    sub: string;
    org_id: string;
}

export interface ElysiaWorkingHoursContext {
    query: WorkingHoursQuery;
    jwt: {
        verify: (token: string) => Promise<JWTPayload | null>;
    };
    set: {
        status: number;
    };
    cookie: {
        auth: {
            value: string;
    };
  };
}