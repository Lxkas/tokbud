import { Elysia } from "elysia";
import { distanceController } from "./controllers/distance";
import { webhookController } from "./controllers/webhook";
import { timeRecordController2 } from "./controllers/time-record";
import { jwtMiddleware } from "@/middleware";
import { workingHoursController } from "./controllers/working-hours";

interface DevSessionParams {
    userId: string
}
  
interface ElysiaDevSessionContext {
    params: DevSessionParams
    jwt: {
        sign: (payload: { sub: string }) => Promise<string>
    }
    cookie: {
        auth: {
            value: string
        }
    }
}
  
export const elysiaApp = new Elysia({ prefix: "/api" })
    .use(jwtMiddleware)
    .get("/dev-session/:userId", async ({ params, jwt, cookie: { auth } }: ElysiaDevSessionContext) => {
        const token = await jwt.sign({
            sub: params.userId,
        });

        console.log(token);

        auth.value = token;

        return `session for user ${params.userId} granted`;
    })
    .use(distanceController)
    .use(webhookController)
    .use(timeRecordController2)
    .use(workingHoursController);

// Log all registered routes
// console.log('All registered routes:');
// elysiaApp.routes.forEach(route => {
//     console.log(`${route.method} ${route.path}`);
// });

export type ElysiaApp = typeof elysiaApp;