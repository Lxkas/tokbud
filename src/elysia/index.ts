import { Elysia } from "elysia";
import { distanceController } from "./controllers/distance";
import { webhookController } from "./controllers/webhook";
import { timeRecordController } from "./controllers/time-record";
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
	.use(timeRecordController)
	.use(workingHoursController);

export type ElysiaApp = typeof elysiaApp;
