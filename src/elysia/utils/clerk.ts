import { createClerkClient } from "@clerk/backend";

export const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

function testClerk() {
  clerkClient.users
    .getOrganizationMembershipList({
      userId: "user_2riGJ090dbQNR41ccdBjkzvA3f6",
    })
    .then((response) => {
      console.log(response.data);
    });
}
