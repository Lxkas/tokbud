import Elysia from "elysia";
import { getUserOrganization } from "@/elysia/services/clerk";
import { getWorkingHours } from "@/elysia/services/working-hours";
import { jwtMiddleware } from "@/middleware";

interface WorkingHoursQuery {
    user_id?: string;
    org_id?: string;
    start_date?: string;
    end_date?: string;
}

interface JWTPayload {
    sub: string;
    org_id?: string;
}

interface ElysiaWorkingHoursContext {
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

export const workingHoursController = new Elysia()
    .use(jwtMiddleware)
    .get("/working-hours/detail", async ({ query, jwt, set, cookie: { auth } }: ElysiaWorkingHoursContext) => {
        try {
            // Verify JWT authentication
            const jwtPayload = await jwt.verify(auth.value);
            if (!jwtPayload) {
                set.status = 401;
                throw new Error("Unauthorized");
            }

            const { user_id, org_id, start_date, end_date } = query;

            // Rule: At least one of user_id or org_id must be specified
            if (!user_id && !org_id) {
                set.status = 400;
                throw new Error("At least one of user_id or org_id must be specified");
            }

            // Rule 3: If both user_id and org_id are specified, verify user belongs to organization
            if (user_id && org_id) {
                const clerkResponse = await getUserOrganization(user_id);
                const userOrgId = clerkResponse?.[0]?.organization?.id;
                
                if (!userOrgId || userOrgId !== org_id) {
                    set.status = 403;
                    throw new Error("User does not belong to the specified organization");
                }
            }

            // Validate date format if provided
            if (start_date && !isValidDateFormat(start_date)) {
                set.status = 400;
                throw new Error("Invalid start_date format. Use YYYY-MM-DD");
            }
            if (end_date && !isValidDateFormat(end_date)) {
                set.status = 400;
                throw new Error("Invalid end_date format. Use YYYY-MM-DD");
            }

            // Get working hours data
            const workingHours = await getWorkingHours({
                user_id,
                org_id,
                start_date,
                end_date
            });

            return workingHours;

        } catch (error: unknown) {
            if (error instanceof Error) {
                set.status = error.message === "Unauthorized" ? 401 : 400;
                return {
                    status: "error",
                    message: error.message
                };
            }
            
            set.status = 400;
            return {
                status: "error",
                message: "Unknown error occurred"
            };
        }
    });

// Helper function to validate date format (YYYY-MM-DD)
function isValidDateFormat(date: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(date)) return false;
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return false;
    
    return true;
}