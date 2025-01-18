import Elysia from "elysia";
import { getUserOrganization } from "@/elysia/services/clerk";
import { getWorkingHours } from "@/elysia/services/working-hours";
import { jwtMiddleware } from "@/middleware";

interface WorkingHoursQuery {
    date?: string
}
  
interface JWTPayload {
    sub: string
}
  
interface ElysiaWorkingHoursContext {
    query: WorkingHoursQuery
    jwt: {
      verify: (token: string) => Promise<JWTPayload | null>
    }
    set: {
      status: number
    }
    cookie: {
      auth: {
        value: string
      }
    }
}

export const workingHoursController = new Elysia()
    .use(jwtMiddleware)
    .get("/working-hours", async ({ query, jwt, set, cookie: { auth } }: ElysiaWorkingHoursContext) => {
        try {
            const jwtPayload = await jwt.verify(auth.value);
            if (!jwtPayload) {
                set.status = 401;
                throw Error("Unauthorized");
            }

            const userId = jwtPayload.sub;
            const date = query.date;

            if (!date) {
                return {
                    status: "error",
                    message: "Missing required query parameter: date",
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