import Elysia from "elysia";
import { getUserOrganization } from "@/elysia/services/clerk";
import { getWorkingHours } from "@/elysia/services/working-hours";

export const workingHoursController = new Elysia()
    .get("/working-hours", async ({ headers }: { 
        headers: { 
            "user-id"?: string;
            "date"?: string;
        } 
    }) => {
        try {
            const userId = headers["user-id"];
            const date = headers["date"];

            if (!userId || !date) {
                return {
                    status: "error",
                    message: "Missing required headers: user-id and date are required",
                };
            }

            // Validate user exists in Clerk
            const clerkResponse = await getUserOrganization(userId);
            if (!clerkResponse || !clerkResponse[0]?.organization?.id) {
                return {
                    status: "error",
                    message: "Could not find organization for this user",
                };
            }

            const workingHours = await getWorkingHours(userId, date);

            return {
                status: "ok",
                data: workingHours,
            };

        } catch (error) {
            return {
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error occurred",
            };
        }
    });