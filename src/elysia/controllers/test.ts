import Elysia, { t } from "elysia";

export const testController = new Elysia({ prefix: "/message" })
	.get("/", () => "Hello From Elysia 🦊")
	// .get("/", () => {
	// 	throw new Error("ERROR MESSAGE");
	// })
	.get("/:message", ({ params }) => `Your Message: ${params.message} 🦊`, {
		params: t.Object({ message: t.String() }),
	})

	.post("/", ({ body }) => body, {
		body: t.Object({
			name: t.String(),
		}),
	});
