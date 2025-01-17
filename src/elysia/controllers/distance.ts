import Elysia from "elysia";
import { OrganizationDoc } from "@/elysia/types/es";
import { getDistance } from "geolib";
import { esClient } from "@/elysia/utils/es";
import { getUserOrganization } from "@/elysia/services/clerk";
import { ES_IDX_ORGANIZATION } from "@/elysia/utils/const";

export const distanceController = new Elysia({ prefix: "/distance" }).get(
	"/",
	async ({
		headers,
	}: {
		headers: {
			"user-id"?: string;
			"user-lat"?: string;
			"user-lon"?: string;
		};
	}) => {
		try {
			// 1. Validate headers
			const userId = headers["user-id"];
			const userLat = headers["user-lat"];
			const userLon = headers["user-lon"];

			if (!userId || !userLat || !userLon) {
				return {
					status: "error",
					message: "Missing required headers: user-id, user-lat, and user-lon are required",
				};
			}

			// 2. Get organization info from Clerk
			const clerkResponse = await getUserOrganization(userId);
			if (!clerkResponse || !clerkResponse[0]?.organization?.id) {
				return {
					status: "error",
					message: "Could not find organization for this user",
				};
			}

			const orgId = clerkResponse[0].organization.id;

			// 3. Get organization location from Elasticsearch
			const result = await esClient.search<OrganizationDoc>({
				index: ES_IDX_ORGANIZATION,
				query: {
					match: {
						id: orgId,
					},
				},
			});

			const orgLocation = result.hits.hits[0]?._source?.location;
			if (!orgLocation) {
				return {
					status: "error",
					message: "Organization location not found in Elasticsearch",
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
						{ latitude: orgLocation.lat, longitude: orgLocation.lon },
					),
				},
			};
		} catch (error) {
			return {
				status: "error",
				message: error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	},
);
