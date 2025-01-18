export interface BaseDoc {
	id: string;
	updated_at: Date;
	deleted_at?: Date;
}

export interface OrganizationDoc extends BaseDoc {
	code: string;
	name: string;
	location?: {
		lat: number;
		lon: number;
	};
}

export interface TimeRecordDoc {
    user_id: string;
    date: string;
    organization_id: string;
    clock_in?: {
        shift_time?: string;
        system_time: string;
        image_url: string;
    };
    clock_out?: {
        shift_time?: string;
        system_time: string;
        image_url: string;
    };
    status: 'complete' | 'incomplete';
}

export interface OvertimeRecordDoc{
    user_id: string;
    date: string;
    shift_id: string;
    organization_id: string;
    start_time: {
        shift_time?: string;
        system_time: string;
        image_url: string;
    };
    end_time?: {
        shift_time?: string;
        system_time: string;
        image_url: string;
    };
    status: 'complete' | 'incomplete';
    ot_hours?: number;
    reason: string;
}

export interface WorkingHoursResponse {
    user_id: string;
    normal_shift?: {
        document_id: string;
        clock_in?: {
            time: string;
            image_url: string;
        };
        clock_out?: {
            time: string;
            image_url: string;
        };
    };
    overtime_shifts: Array<{
        document_id: string;
        start_time: {
            time: string;
            image_url: string;
        };
        end_time?: {
            time: string;
            image_url: string;
        };
    }>;
}