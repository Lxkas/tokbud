import Elysia from "elysia";
import { OvertimeRecordDoc } from "@/elysia/types/es";
import { esClient } from "@/elysia/utils/es";
import { getUserOrganization } from "@/elysia/services/clerk";
import { ES_IDX_OVERTIME_RECORD } from "@/elysia/utils/const";
import { jwtMiddleware } from "@/middleware";

interface OvertimeClockInBody {
    img_url: string;
    reason: string;
    shift_time?: string;
}

interface OvertimeClockOutBody {
    document_id: string;
    img_url: string;
    shift_time?: string;
}

interface JWTPayload {
    sub: string
  }
  
  interface ElysiaOvertimeContext {
    body: OvertimeClockInBody | OvertimeClockOutBody
    jwt: {
      verify: (token: string) => Promise<JWTPayload | null>
    }
    set: {
      status: number
    }
    cookie: {
      auth: {
        value: string
      }
    }
  }

export const overtimeController = new Elysia({ prefix: "/overtime" })
    .use(jwtMiddleware)    
    .post("/clock-in", async ({ body, jwt, set, cookie: { auth } }: ElysiaOvertimeContext) => {
        try {
            const jwtPayload = await jwt.verify(auth.value);
            if (!jwtPayload) {
                set.status = 401;
                throw Error("Unauthorized");
            }

            const user_id = jwtPayload.sub;
            console.log(user_id)
            const { img_url, reason, shift_time } = body as OvertimeClockInBody;

            // Validate required fields
            if (!img_url || !reason) {
                return {
                    status: "error",
                    message: "Missing required fields: img_url and reason are required",
                };
            }

            // Validate user exists in Clerk
            const clerkResponse = await getUserOrganization(user_id);
            if (!clerkResponse || !clerkResponse[0]?.organization?.id) {
                return {
                    status: "error",
                    message: "Could not find organization for this user",
                };
            }

            const now = new Date();
            const currentDate = now.toISOString().split('T')[0];
            const systemTime = now.toISOString();

            // Create shift_id using user_id + date + system time
            const shift_id = `${user_id}_ot_${systemTime.replace(/[-:\.]/g, '').slice(0, 14)}`;

            // Prepare document
            const overtimeDoc: OvertimeRecordDoc = {
                user_id,
                date: currentDate,
                shift_id,
                organization_id: clerkResponse[0].organization.id,
                start_time: {
                    system_time: systemTime,
                    image_url: img_url,
                },
                status: 'incomplete',
                reason
            };

            // Add shift_time if provided
            if (shift_time) {
                overtimeDoc.start_time.shift_time = shift_time;
            }

            // Index the document
            const result = await esClient.index({
                index: ES_IDX_OVERTIME_RECORD,
                document: overtimeDoc,
            });

            return {
                status: "ok",
                data: {
                    document_id: result._id,
                    shift_id
                },
            };

        } catch (error) {
            return {
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error occurred",
            };
        }
    })
    .post("/clock-out", async ({ body, jwt, set, cookie: { auth } }: ElysiaOvertimeContext) => {
        try {
            const jwtPayload = await jwt.verify(auth.value);
            if (!jwtPayload) {
                set.status = 401;
                throw Error("Unauthorized");
            }

            const user_id = jwtPayload.sub;
            const { document_id, img_url, shift_time } = body as OvertimeClockOutBody;

            // Validate required fields
            if (!document_id || !img_url) {
                return {
                    status: "error",
                    message: "Missing required fields: document_id and img_url are required",
                };
            }

            // Validate user exists in Clerk
            const clerkResponse = await getUserOrganization(user_id);
            if (!clerkResponse || !clerkResponse[0]?.organization?.id) {
                return {
                    status: "error",
                    message: "Could not find organization for this user",
                };
            }

            try {
                // Get the existing document to verify ownership
                const existingDoc = await esClient.get<OvertimeRecordDoc>({
                    index: ES_IDX_OVERTIME_RECORD,
                    id: document_id
                });

                if (!existingDoc._source) {
                    return {
                        status: "error",
                        message: "Cannot find overtime record with the provided document ID",
                    };
                }

                if (existingDoc._source.user_id !== user_id) {
                    return {
                        status: "error",
                        message: "Document does not belong to this user",
                    };
                }

                if (existingDoc._source.status === 'complete') {
                    return {
                        status: "error",
                        message: "This overtime shift is already completed",
                    };
                }

                // Prepare update document
                const now = new Date();
                const updateDoc: any = {
                    end_time: {
                        system_time: now.toISOString(),
                        image_url: img_url,
                    },
                    status: 'complete'
                };

                // Add shift_time if provided
                if (shift_time) {
                    updateDoc.end_time.shift_time = shift_time;
                }

                // Update the document
                await esClient.update({
                    index: ES_IDX_OVERTIME_RECORD,
                    id: document_id,
                    doc: updateDoc,
                });

                return {
                    status: "ok",
                    data: {
                        document_id,
                    },
                };
            } catch (error: any) {
                // Handle Elasticsearch errors
                if (error.statusCode === 404 || error.status === 404) {
                    return {
                        status: "error",
                        message: "Cannot find overtime record with the provided document ID",
                    };
                }
                if (error.name === 'ElasticsearchClientError') {
                    return {
                        status: "error",
                        message: "Error accessing overtime record database",
                    };
                }
                // Re-throw unexpected errors to be caught by outer catch block
                throw error;
            }
        } catch (error) {
            return {
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error occurred",
            };
        }
    });