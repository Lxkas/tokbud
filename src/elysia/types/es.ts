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
    overtime_details?: {
      ot_hours?: number;
      reason?: string;
    };
  }
  
  export interface WorkingHoursResponse {
    user_id: string;
    shifts: {
      document_id: string;
      shift_type: 'regular' | 'overtime';
      shift_id?: string;
      start_time?: {
        time: string;
        image_url: string;
      };
      end_time?: {
        time: string;
        image_url: string;
      };
      overtime_details?: {
        reason?: string;
        ot_hours?: number;
      };
    }[];
  }