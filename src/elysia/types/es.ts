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