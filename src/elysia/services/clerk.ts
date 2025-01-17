import { clerkClient } from "@/elysia/utils/clerk";

export async function getUserOrganization(userId: string) {
	const response = await clerkClient.users.getOrganizationMembershipList({
		userId: userId,
		// userId: "user_2riGJ090dbQNR41ccdBjkzvA3f6",
		// userId: "user_2rkKh0dgkzfzB3taTyy1KsRxorW",
		// userId: "user_2rkKhy9VF2JziL7q4OgH5f7T85y",
	});
	return response.data;
}
