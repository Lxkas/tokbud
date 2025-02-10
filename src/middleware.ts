import { clerkMiddleware } from "@clerk/nextjs/server";
import jwt from "@elysiajs/jwt";

export default clerkMiddleware();

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
	runtime: "nodejs", // Specify the runtime environment as Node.js
};

if (!process.env.JWT_SECRET) {
	throw Error("Missing JWT_SECRET");
}

export const jwtMiddleware = jwt({
	name: "jwt",
	secret: process.env.JWT_SECRET ?? "",
	alg: "HS256",
});
