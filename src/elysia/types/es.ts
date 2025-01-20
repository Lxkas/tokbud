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
interface TimeShift {
  shift_time?: string;
  system_time: string;
  image_url: string;
}

interface ShiftRecord {
  start_time: TimeShift;
  end_time?: TimeShift;
}

export interface TimeRecordDoc {
  user_id: string;
  date: string;
  organization_id: string;
  shift_type: 'regular' | 'overtime';
  shift_id?: string;
  shifts: ShiftRecord[];
  status: 'complete' | 'incomplete';
  shift_details: {
      hours: number;
      reason: string;
  };
}

export interface WorkingHoursShift {
  document_id: string;
  shift_type: 'regular' | 'overtime';
  shift_id?: string;
  start_time?: {
      system_time: string;
      image_url: string;
      shift_time?: string;
  };
  end_time?: {
      system_time: string;
      image_url: string;
      shift_time?: string;
  };
  shift_details: {
      reason: string;
      hours: number;
  };
  status: 'complete' | 'incomplete';
}

export interface WorkingHoursByDate {
  date: string;  // UTC date
  shift: WorkingHoursShift[];
}

export interface WorkingHoursResponse {
  user_id: string;
  shifts: WorkingHoursByDate[];
}