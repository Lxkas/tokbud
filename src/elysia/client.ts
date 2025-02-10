import type { ElysiaApp } from ".";
import { treaty } from "@elysiajs/eden";

const url = "https://tokbud.stamford.dev"; 
export const elysia = treaty<ElysiaApp>(url, {
	fetch: {
		next: { revalidate: 0 },
	},
});
