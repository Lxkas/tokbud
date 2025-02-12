// For service
export interface TimeDetails {
    shift_time?: string;
    timestamp?: string;
    image_url?: string;
    lat?: number;
    lon?: number;
}

export interface ChangeLogEntry {
    is_system: string | boolean;
    timestamp: string;
    edit_reason: string;
    lat: number;
    lon: number;
    data: {
        shift_reason?: string;
        start_time?: TimeDetails;
        end_time?: TimeDetails | null;
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

export interface ExportedWorkingHourResponse {
    status: string;
    data: ExportedUserWorkingHour[];
}

export interface ExportedUserWorkingHour {
    user_id: string;
    org_id: string;
    all_shift: ExportedDayShift[];
}

export interface ExportedDayShift {
    date: string;
    on_site?: (ExportedShiftDetail | ExportedIncompleteShift)[];
    overtime?: (ExportedShiftDetail | ExportedIncompleteShift)[];
    // Add other shift types as needed
}

export interface ExportedShiftDetail {
    doc_id: string;
    start: string;
    end: string;
    start_official: string;
    end_official: string;
    duration: string;
    duration_official: string;
    reason: string;
    change_history: string[];
}

export interface ExportedIncompleteShift {
    doc_id: string;
    message: string;
}

export interface WorkingHoursSummary {
    user_id: string;
    total_working_hours: string;
    total_working_days: number;
    org_id: string;
}

export interface WorkingHoursSummaryResponse {
    status: string;
    data: WorkingHoursSummary[];
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

export interface UserResponse {
    user_id: string;
    employee_id: string | null;
    img: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    branch_id: string | null;
    branch_name: string | null;
    position: string | null;
}

export interface RequestContext {
    set: {
        status: number;
        headers?: Record<string, string>;
    };
}

export interface WorkingHoursSummaryRequest {
    user_ids: string[];
    start_date?: string;  // Optional date in YYYY-MM-DD format
    end_date?: string;    // Optional date in YYYY-MM-DD format
    sort_dates_ascending?: boolean;
}

export interface WorkingHoursSummaryRequestContext {
    set: {
        status: number;
        headers?: Record<string, string>;
    };
    body: WorkingHoursSummaryRequest;
}