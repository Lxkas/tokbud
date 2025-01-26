export interface TimeInfo {
    shift_time: string;
    timestamp: string;
    image_url: string;
    lat: number;
    lon: number;
}

export interface TimeRecordDoc {
    date: string;
    user_id: string;
    org_id: string;
    shift_type: string;
    is_complete: boolean;
    reason: string;
    start_time: TimeInfo;
    end_time: TimeInfo | null;
    change_log: string[];
}

export interface JWTPayload {
    sub: string;
    org_id: string;
}

export interface ClockInBody {
    shift_type?: string;
    reason?: string;
    shift_time: string;
    image_url: string;
    lat: number;
    lon: number;
}

export interface ElysiaClockInContext {
    body: ClockInBody;
    jwt: {
        verify: (token: string) => Promise<JWTPayload | null>
    };
    set: {
        status: number
    };
    cookie: {
        auth: {
            value: string
        }
    };
}

export interface ClockOutBody {
    doc_id: string;
    shift_time: string;
    image_url: string;
    lat: number;
    lon: number;
}

export interface ElysiaClockOutContext {
    body: ClockOutBody;
    jwt: {
        verify: (token: string) => Promise<JWTPayload | null>
    };
    set: {
        status: number
    };
    cookie: {
        auth: {
            value: string
        }
    };
}