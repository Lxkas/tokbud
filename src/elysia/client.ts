import type { ElysiaApp } from ".";
import { treaty } from "@elysiajs/eden";

const url = process.env.URL_DOMAIN ?? "localhost:3000";
export const elysia = treaty<ElysiaApp>(url, {
	fetch: {
		next: { revalidate: 0 },
	},
});
