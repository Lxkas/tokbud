import { clerkClient } from "@/elysia/utils/clerk";
import { User, OrganizationMembership } from "@clerk/backend";

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

export async function getAllUsersWithOrganizations() {
    try {
        // Get all users first
        const usersResponse = await clerkClient.users.getUserList();
        
        // Get organization data for each user
        const usersWithOrgs = await Promise.all(
            usersResponse.data.map(async (user: User) => {
                try {
                    const orgMemberships = await clerkClient.users.getOrganizationMembershipList({
                        userId: user.id
                    });
                    
                    return {
                        ...user,
                        organizations: orgMemberships.data
                    };
                } catch (error) {
                    // If user has no organizations, return user with empty org array
                    return {
                        ...user,
                        organizations: []
                    };
                }
            })
        );

        return usersWithOrgs;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch users with organizations: ${error.message}`);
        }
        throw error;
    }
}