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
