import Elysia from "elysia";
import { getUserOrganization, getAllUsersWithOrganizations } from "@/elysia/services/clerk";
import { getWorkingHours, getWorkingHoursExporter, getWorkingHoursSummary } from "@/elysia/services/working-hours";
import { jwtMiddleware } from "@/middleware";
import { ElysiaWorkingHoursContext, RequestContext, WorkingHoursSummaryRequestContext } from "@/elysia/types/working-hours";
import { isValidDateFormat, transformUserData, validateRequest } from "@/elysia/utils/helpers"

export const workingHoursController = new Elysia()
    .use(jwtMiddleware)
    .post("/users/working-hours-summary", async ({ set, body }: WorkingHoursSummaryRequestContext) => {
        const summary = await getWorkingHoursSummary({
            user_ids: ['user_2srDWveiLNfK82G9cafoYiFk2QQ',
                'user_2srDR9L3cGp4cMwoHChzmGSW6FD',
                'user_2sZiSwg8vtclo9Axc2FdwBWxVPq',
                'user_2rkKhy9VF2JziL7q4OgH5f7T85y',
                'user_2rkKh0dgkzfzB3taTyy1KsRxorW',
                'user_2riGKbNYXYcEw48Muzgp0N3y5vE',
                'user_2riGJwrbjeqS3iHPEcZze9ZheuP',
                'user_2rhkBbqbyoTvNs7FIje4DWKDgFv'
            ],
            start_date: '2025-01-01',
            end_date: '2025-04-31',
            sort_dates_ascending: true
        });
        try {
            // Validate request body
            const validationError = validateRequest(body);
            if (validationError) {
                set.status = 400;
                return {
                    success: false,
                    error: validationError
                };
            }
    
            // Call the summary function with the provided parameters
            const summary = await getWorkingHoursSummary({
                user_ids: body.user_ids,
                start_date: body.start_date,
                end_date: body.end_date,
                sort_dates_ascending: body.sort_dates_ascending
            });
    
            return {
                success: true,
                data: summary
            };
    
        } catch (error) {
            set.status = 500;
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch working hours summary"
            };
        }
    })
    .get("/users/all", async ({ set }: RequestContext) => {
        try {
            const usersWithOrgs = await getAllUsersWithOrganizations();
            const transformedUsers = usersWithOrgs.map(transformUserData);
            
            return {
                success: true,
                data: transformedUsers
            };
        } catch (error) {
            set.status = 500;
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch users with organizations"
            };
        }
    })
    .get("/working-hours/export", async ({ query, jwt, set, cookie: { auth } }: ElysiaWorkingHoursContext) => {
        try {
            // Verify JWT authentication
            const jwtPayload = await jwt.verify(auth.value);
            if (!jwtPayload) {
                set.status = 401;
                throw new Error("Unauthorized");
            }

            const { 
                user_id, 
                org_id, 
                start_date, 
                end_date, 
                sort_dates_ascending, 
                sort_shifts_ascending 
            } = query;
            
            const user_id_jwt = jwtPayload.sub;
            const org_id_jwt = jwtPayload.org_id;

            // Convert string query parameters to boolean
            const parseSortParam = (param: string | undefined): boolean | undefined => {
                if (param === undefined) return undefined;
                return param.toLowerCase() === 'true';
            };

            const sortDatesAsc = parseSortParam(sort_dates_ascending);
            const sortShiftsAsc = parseSortParam(sort_shifts_ascending);

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

            // Get working hours export data
            const exportData = await getWorkingHoursExporter({
                user_id: effectiveUserId,
                org_id: effectiveOrgId,
                start_date,
                end_date,
                sort_dates_ascending: sortDatesAsc,
                sort_shifts_ascending: sortShiftsAsc
            });

            return exportData;

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
    })
    .get("/working-hours/detail", async ({ query, jwt, set, cookie: { auth } }: ElysiaWorkingHoursContext) => {
        try {
            // Verify JWT authentication
            const jwtPayload = await jwt.verify(auth.value);
            if (!jwtPayload) {
                set.status = 401;
                throw new Error("Unauthorized");
            }

            const { 
                user_id, 
                org_id, 
                start_date, 
                end_date, 
                sort_dates_ascending, 
                sort_shifts_ascending 
            } = query;
            
            const user_id_jwt = jwtPayload.sub;
            const org_id_jwt = jwtPayload.org_id;

            // Convert string query parameters to boolean
            const parseSortParam = (param: string | undefined): boolean | undefined => {
                if (param === undefined) return undefined;
                return param.toLowerCase() === 'true';
            };

            const sortDatesAsc = parseSortParam(sort_dates_ascending);
            const sortShiftsAsc = parseSortParam(sort_shifts_ascending);

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
                end_date,
                sort_dates_ascending: sortDatesAsc,
                sort_shifts_ascending: sortShiftsAsc
            });
            
            // const exporter = await getWorkingHoursExporter({
            //     user_id: effectiveUserId,
            //     org_id: effectiveOrgId,
            //     start_date,
            //     end_date,
            //     sort_dates_ascending: sortDatesAsc,
            //     sort_shifts_ascending: sortShiftsAsc
            // });

            // console.log(JSON.stringify(exporter, null, 2));

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
