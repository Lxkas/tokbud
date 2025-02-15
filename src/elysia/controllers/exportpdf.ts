import Elysia from "elysia";
import { jwtMiddleware } from "@/middleware";
import { getAllUsersWithOrganizations } from "@/elysia/services/clerk";
import { getBulkLatestUserStatus } from "@/elysia/services/es";
import { transformUserData } from "@/elysia/utils/helpers";
import { getWorkingHoursExporter } from "@/elysia/services/working-hours";

// Interfaces for the exported data structure
interface ExportedShiftDetail {
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

interface ExportedIncompleteShift {
  doc_id: string;
  duration_official: string;
  reason?: string;
  change_history?: string[];
}

interface ExportedDayShift {
  date: string;
  "on-site"?: (ExportedShiftDetail | ExportedIncompleteShift)[];
  overtime?: (ExportedShiftDetail | ExportedIncompleteShift)[];
}

interface WorkingHoursData {
  user_id: string;
  org_id: string;
  all_shift: ExportedDayShift[];
}

interface ExportPdfBody {
  user_ids: string[];
  start_date: string;
  end_date: string;
}

interface JWTPayload {
  sub: string;
}

interface ElysiaExportContext {
  body: ExportPdfBody;
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

// Basic shift interface for both complete and incomplete shifts
interface BaseShiftData {
    doc_id: string;
    duration_official?: string;  // Made optional to match ExportedIncompleteShift
    reason?: string;
    change_history?: string[];
}

// Daily shift data structure
interface DailyShiftData {
    date: string;
    "on-site"?: BaseShiftData[];
    overtime?: BaseShiftData[];
}

// Response interfaces
interface UserWorkingHourData {
    user_id: string;
    org_id: string;
    all_shift: DailyShiftData[];
}

interface WorkingHourResponse {
    status: string;
    data: UserWorkingHourData[];
}

// Working summary calculation function
const calculateWorkingSummary = (shifts: DailyShiftData[]): string => {
    if (!shifts.length) return '0hrs/0days';

    let totalMinutes = 0;
    const uniqueDays = new Set(shifts.map(shift => shift.date)).size;

    shifts.forEach(dailyShift => {
        // Calculate onsite duration
        dailyShift["on-site"]?.forEach(shift => {
        if (shift.duration_official) {  // Check if duration_official exists
            const [hours, minutes] = shift.duration_official.split(':').map(Number);
            totalMinutes += hours * 60 + minutes;
        }
        });

        // Calculate overtime duration
        dailyShift.overtime?.forEach(shift => {
        if (shift.duration_official) {  // Check if duration_official exists
            const [hours, minutes] = shift.duration_official.split(':').map(Number);
            totalMinutes += hours * 60 + minutes;
        }
        });
    });

    const totalHours = Math.floor(totalMinutes / 60);
    return `${totalHours}hrs/${uniqueDays}days`;
};

export const exportPdfController = new Elysia({ prefix: "/export-pdf" })
  .use(jwtMiddleware)
  .post("/", async ({ body, jwt, set, cookie: { auth } }: ElysiaExportContext) => {
    try {
      // 1. Verify JWT token
      const jwtPayload = await jwt.verify(auth.value);
      if (!jwtPayload) {
        set.status = 401;
        throw Error("Unauthorized");
      }

      // 2. Validate request body
      const { user_ids, start_date, end_date } = body;
      if (!user_ids || !start_date || !end_date) {
        set.status = 400;
        throw Error("Missing required fields: user_ids, start_date, and end_date are required");
      }

      // 3. Get all users with organizations and their status
      const usersWithOrgs = await getAllUsersWithOrganizations();
      const transformedUsers = usersWithOrgs.map(transformUserData);
      const userIds = transformedUsers.map(user => user.user_id);
      const workingStatuses = await getBulkLatestUserStatus(userIds);

      // 4. Combine user data with status
      const usersWithStatus = transformedUsers.map((user, index) => ({
        ...user,
        is_working: workingStatuses[index]
      }));

      // 5. Filter users based on requested user_ids
      const filteredUsers = usersWithStatus.filter(user => 
        user_ids.includes(user.user_id)
      );

      // 6. Get working hours summary for each user
      const exportPromises = filteredUsers.map(async user => {
        const workingHours = await getWorkingHoursExporter({
          user_id: user.user_id,
          start_date,
          end_date,
          sort_dates_ascending: true,
          sort_shifts_ascending: true
        });

        // 7. Combine user info with working hours data
        return {
          user_id: user.user_id,
          org_id: user.branch_id,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          avatarUrl: user.img,
          branch: user.branch_name,
          workingSummary: calculateWorkingSummary(workingHours.data[0]?.all_shift || []),
          status: user.is_working ? "online" : "offline",
          email: user.email,
          position: user.position || "",
          all_shift: workingHours.data[0]?.all_shift || []
        };
      });

      const exportData = await Promise.all(exportPromises);

      return {
        status: "ok",
        data: exportData
      };

    } catch (error) {
      set.status = set.status || 500;
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  });