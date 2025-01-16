import { Elysia, t } from "elysia";
import { testController } from "@/elysia/controllers/test";

export const elysiaApp = new Elysia({ prefix: "/api" }).use(testController).onError(({ code, error }) => {
	console.error(code);
	return new Response(JSON.stringify({ error: error.toString() }), { status: 500 });
});

export type ElysiaApp = typeof elysiaApp;
