import Elysia, { error, t } from "elysia";
import { jwtMiddleware } from "@/middleware";
import { s3Client } from "@/elysia/utils/s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const MAX_MEDIA_SIZE = 1024 * 1024 * 10;
const ACCEPTED_CONTENT_TYPE = ["image/png", "image/jpeg", "image/jpg", "image/gif"];

export const uploadController = new Elysia({ prefix: "/upload" }).use(jwtMiddleware).post(
	"/",
	async ({ jwt, set, body, cookie: { auth } }) => {
		const jwtPayload = await jwt.verify(auth.value);
		if (!jwtPayload) {
			set.status = 401;
			return error(401, "requires user token");
		}

		try {
			if (!body.fileKey) {
				return error(400, "File key is missing");
			}

			if (body.contentSize > MAX_MEDIA_SIZE) {
				return error(400, "Media is too big");
			}

			if (!ACCEPTED_CONTENT_TYPE.includes(body.contentType)) {
				return error(400, "Unsupported media type");
			}

			const signedUrl = await getSignedUrl(
				s3Client,
				new PutObjectCommand({
					Bucket: "tokbud",
					Key: `time-record/${body.fileKey}`,
					ContentType: body.contentType,
					ContentLength: body.contentSize,
				}),
				{ expiresIn: 300 },
			);

			return { signedUrl: signedUrl };
		} catch (err) {
			return error(500, err);
		}
	},
	{
		body: t.Object({
			fileKey: t.String(),
			contentType: t.String(),
			contentSize: t.Number(),
		}),
	},
);
