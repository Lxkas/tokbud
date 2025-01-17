import { Elysia } from "elysia";
import { ClerkOrganizationWebhook } from "./types/clerk";
import { OrganizationDoc } from "./types/organization";
import { syncOrganizations } from "./organization/clerk";
import { esClient } from "./utils/es";
import { testClerk } from "./utils/clerk";
import { getDistance } from 'geolib';

export const elysiaApp = new Elysia({ prefix: "/api" })
	.get("/", () => "Hello Elysia")
	.get("/health", async () => {
		try {
			const health = await esClient.cluster.health();
			return { status: "ok", elasticsearch: health };
		} catch (error) {
			return {
				status: "error",
				message: error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	})
	.post("/webhook/clerk", ({ body }: { body: { data: ClerkOrganizationWebhook } }) => {
		syncOrganizations(body.data);
	})
	.get("/test", async ({ headers }: { headers: { 'user-id'?: string } }) => {
		try {
			const userId = headers['user-id'];
			
			if (!userId) {
				return {
					status: "error",
					message: "User ID is required in headers"
				};
			}
	
			const testUser = await testClerk(userId);
			return { status: "ok", test_user: testUser };
		} catch (error) {
			return {
				status: "error",
				message: error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	})
	.get("/distance", async ({ headers }: { headers: { 
		'user-id'?: string,
		'user-lat'?: string,
		'user-lon'?: string 
	} }) => {
		try {
			// 1. Validate headers
			const userId = headers['user-id'];
			const userLat = headers['user-lat'];
			const userLon = headers['user-lon'];
			
			if (!userId || !userLat || !userLon) {
				return {
					status: "error",
					message: "Missing required headers: user-id, user-lat, and user-lon are required"
				};
			}
	
			// 2. Get organization info from Clerk
			const clerkResponse = await testClerk(userId);
			if (!clerkResponse || !clerkResponse[0]?.organization?.id) {
				return {
					status: "error",
					message: "Could not find organization for this user"
				};
			}
	
			const orgId = clerkResponse[0].organization.id;
	
			// 3. Get organization location from Elasticsearch
			const result = await esClient.search<OrganizationDoc>({
				index: 'organization',
				query: {
					match: {
						id: orgId
					}
				}
			});
	
			const orgLocation = result.hits.hits[0]?._source?.location;
			if (!orgLocation) {
				return {
					status: "error",
					message: "Organization location not found in Elasticsearch"
				};
			}
	
			// 4. Return all coordinates
			return {
				status: "ok",
				data: {
					// user_location: {
					// 	lat: parseFloat(userLat),
					// 	lon: parseFloat(userLon)
					// },
					// organization_location: {
					// 	lat: orgLocation.lat,
					// 	lon: orgLocation.lon
					// },
					distance: getDistance(
						{ latitude: parseFloat(userLat), longitude: parseFloat(userLon) },
						{ latitude: orgLocation.lat, longitude: orgLocation.lon }
					)
				}
			};
	
		} catch (error) {
			return {
				status: "error",
				message: error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	});

export type ElysiaApp = typeof elysiaApp;
