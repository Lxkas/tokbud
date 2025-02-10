import { S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
	credentials: {
		accessKeyId: "admin",
		secretAccessKey: "admin",
	},
	forcePathStyle: true,
	endpoint: "https://uploads.stamford.dev",
});
