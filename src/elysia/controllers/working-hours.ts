import Elysia from "elysia";
import { getUserOrganization } from "@/elysia/services/clerk";
import { getWorkingHours } from "@/elysia/services/working-hours";
import { jwtMiddleware } from "@/middleware";
import { ElysiaWorkingHoursContext } from "@/elysia/types/working-hours";
import { isValidDateFormat } from "@/elysia/utils/helpers"

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
            const user_id_jwt = jwtPayload.sub;
            const org_id_jwt = jwtPayload.org_id;

            // Determine request context and apply appropriate authorization
            let effectiveUserId = user_id;
            let effectiveOrgId = org_id;

            // If query parameters are not provided, use JWT values (user context)
            if (!user_id && !org_id) {
                effectiveUserId = user_id_jwt;
                effectiveOrgId = org_id_jwt;
            } else {
                // Admin/Backend context - Additional security checks
                
                // Check if user has permission to access other users' data
                const hasAdminAccess = await checkAdminAccess(user_id_jwt, org_id_jwt);
                if (!hasAdminAccess) {
                    // If no admin access, can only access own data
                    if (user_id && user_id !== user_id_jwt) {
                        set.status = 403;
                        throw new Error("Unauthorized to access other user's data");
                    }
                    if (org_id && org_id !== org_id_jwt) {
                        set.status = 403;
                        throw new Error("Unauthorized to access other organization's data");
                    }
                }

                // Verify user belongs to organization if both are specified
                if (effectiveUserId && effectiveOrgId) {
                    const clerkResponse = await getUserOrganization(effectiveUserId);
                    const userOrgId = clerkResponse?.[0]?.organization?.id;
                    
                    if (!userOrgId || userOrgId !== effectiveOrgId) {
                        set.status = 403;
                        throw new Error("User does not belong to the specified organization");
                    }
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
                user_id: effectiveUserId,
                org_id: effectiveOrgId,
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


async function checkAdminAccess(userId: string, orgId: string): Promise<boolean> {
    // to be implement admin access check logic here
    // check if user has admin role in the organization
    return true;
}
