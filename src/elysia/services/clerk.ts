import { clerkClient } from "@/elysia/utils/clerk";

export async function getUserOrganization(userId: string) {
	try {
		const response = await clerkClient.users.getOrganizationMembershipList({
			userId: userId,
			// userId: "user_2riGJ090dbQNR41ccdBjkzvA3f6",
			// userId: "user_2rkKh0dgkzfzB3taTyy1KsRxorW",
			// userId: "user_2rkKhy9VF2JziL7q4OgH5f7T85y",
		});
		return response.data;
	} catch (error) {
		// Check if it's a Clerk API error
		if (error instanceof Error && error.message === "Not Found") {
			throw new Error("Could not find organization for this user");
		}
		// Re-throw other unexpected errors
		throw error;
	}
}
