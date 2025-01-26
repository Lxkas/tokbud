import Elysia from "elysia";
import { jwtMiddleware } from "@/middleware";
import { getUserOrganization } from "@/elysia/services/clerk";
import { esClient } from "@/elysia/utils/es";
import { ES_IDX_TIME_RECORD } from "@/elysia/utils/const";
import { TimeRecordDoc, ElysiaTimeRecordContext, TimeInfo, ElysiaClockOutContext } from "@/elysia/types/time-record";
import { isValidUTCDateTime, createChangeLogJSON } from "@/elysia/utils/helpers";

export const timeRecordController2 = new Elysia({ prefix: "/time-record-2" })
    .use(jwtMiddleware)
    .post("/clock-in", async ({ body, jwt, set, cookie: { auth } }: ElysiaTimeRecordContext) => {
        try {
            // Verify JWT and get user_id
            const jwtPayload = await jwt.verify(auth.value);
            if (!jwtPayload) {
                set.status = 401;
                throw Error("Unauthorized");
            }

            const user_id = jwtPayload.sub;
            const { shift_type, reason, shift_time, image_url, lat, lon } = body;

            // Validate mandatory fields
            const mandatoryFields = ['shift_time', 'image_url', 'lat', 'lon'];
            const missingFields = mandatoryFields.filter(field => !(field in body));

            if (missingFields.length > 0) {
                set.status = 400;
                return {
                    status: "error",
                    message: `Missing mandatory fields: ${missingFields.join(', ')}`
                };
            }

            // Validate shift_time format
            if (!isValidUTCDateTime(shift_time)) {
                set.status = 400;
                return {
                    status: "error",
                    message: "Invalid shift_time format. Expected format: 2024-01-25T08:30:45.123Z"
                };
            }

            // Get organization ID
            const clerkResponse = await getUserOrganization(user_id);
            if (!clerkResponse || !clerkResponse[0]?.organization?.id) {
                set.status = 404;
                return {
                    status: "error",
                    message: "Could not find organization for this user",
                };
            }

            const org_id = clerkResponse[0].organization.id;
            const currentTime = new Date().toISOString();
            const recordDate = shift_time.split('T')[0];

            // Prepare time info
            const startTimeInfo: TimeInfo = {
                shift_time,
                timestamp: currentTime,
                image_url,
                lat,
                lon
            };

            // Create the document
            const timeRecord: TimeRecordDoc = {
                date: recordDate,
                user_id,
                org_id,
                shift_type: shift_type || "",
                is_complete: false,
                reason: reason || "",
                start_time: startTimeInfo,
                end_time: null,
                change_log: [
                    createChangeLogJSON({
                        isSystem: true,
                        edit_reason: "[SYSTEM] regular clock-in",
                        lat: startTimeInfo.lat,
                        lon: startTimeInfo.lon,
                        startTimeInfo: startTimeInfo,
                        shift_reason: reason || ""
                    })
                ]
            };

            // Insert into Elasticsearch
            const result = await esClient.index({
                index: ES_IDX_TIME_RECORD,
                document: timeRecord,
            });

            return {
                status: "success",
                data: {
                    document_id: result._id
                }
            };

        } catch (error: unknown) {
            // Type guard for objects with status property
            if (error && typeof error === 'object' && 'status' in error) {
                set.status = (error as { status: number }).status;
            } else {
                set.status = 500;
            }
            
            return {
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error occurred",
            };
        }
    })
    .post("/clock-out", async ({ body, jwt, set, cookie: { auth } }: ElysiaClockOutContext) => {
        try {
            // Verify JWT and get user_id
            const jwtPayload = await jwt.verify(auth.value);
            if (!jwtPayload) {
                set.status = 401;
                throw Error("Unauthorized");
            }

            const user_id = jwtPayload.sub;
            const { doc_id, shift_time, image_url, lat, lon } = body;

            // Validate mandatory fields
            const mandatoryFields = ['doc_id', 'shift_time', 'image_url', 'lat', 'lon'];
            const missingFields = mandatoryFields.filter(field => !(field in body));

            if (missingFields.length > 0) {
                set.status = 400;
                return {
                    status: "error",
                    message: `Missing mandatory fields: ${missingFields.join(', ')}`
                };
            }

            // Validate shift_time format
            if (!isValidUTCDateTime(shift_time)) {
                set.status = 400;
                return {
                    status: "error",
                    message: "Invalid shift_time format. Expected format: 2024-01-25T08:30:45.123Z"
                };
            }

            // Get existing document
            try {
                const existingDoc = await esClient.get<TimeRecordDoc>({
                    index: ES_IDX_TIME_RECORD,
                    id: doc_id
                });

                if (!existingDoc._source) {
                    set.status = 404;
                    return {
                        status: "error",
                        message: "Time record not found"
                    };
                }

                // Verify document ownership
                if (existingDoc._source.user_id !== user_id) {
                    set.status = 403;
                    return {
                        status: "error",
                        message: "You are not authorized to update this record"
                    };
                }

                // Check if already completed
                if (existingDoc._source.is_complete) {
                    set.status = 400;
                    return {
                        status: "error",
                        message: "This time record is already completed"
                    };
                }

                // Validate end time is after start time
                const startTime = new Date(existingDoc._source.start_time.shift_time);
                const endTime = new Date(shift_time);

                if (endTime <= startTime) {
                    set.status = 400;
                    return {
                        status: "error",
                        message: `End time (${endTime}) must be after start time (${startTime})`,
                    };
                }

                // Prepare end time info
                const currentTime = new Date().toISOString();
                const endTimeInfo: TimeInfo = {
                    shift_time,
                    timestamp: currentTime,
                    image_url,
                    lat,
                    lon
                };

                // After successful update but before final return
                const startTimeDocInfo = await esClient.get<TimeRecordDoc>({
                    index: ES_IDX_TIME_RECORD,
                    id: doc_id,
                    _source_includes: ['reason', 'start_time']  // Only fetch the fields we need
                });

                const startTimeInfo: TimeInfo = {
                    shift_time: startTimeDocInfo._source?.start_time?.shift_time ?? "",
                    timestamp: startTimeDocInfo._source?.start_time?.timestamp ?? "",
                    image_url: startTimeDocInfo._source?.start_time?.image_url ?? "",
                    lat: startTimeDocInfo._source?.start_time?.lat ?? 0,
                    lon: startTimeDocInfo._source?.start_time?.lon ?? 0
                };

                // Create change log entry
                const changeLogEntry = createChangeLogJSON({
                    isSystem: true,
                    edit_reason: "[SYSTEM] regular clock-out",
                    lat: lat,
                    lon: lon,
                    startTimeInfo: startTimeInfo,
                    endTimeInfo: endTimeInfo,
                    shift_reason: startTimeDocInfo._source?.reason || ""
                });

                // Update document
                await esClient.update({
                    index: ES_IDX_TIME_RECORD,
                    id: doc_id,
                    doc: {
                        end_time: endTimeInfo,
                        is_complete: true,
                        change_log: [...existingDoc._source.change_log, changeLogEntry]
                    }
                });

                return {
                    status: "success",
                    data: {
                        doc_id
                    }
                };

            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'statusCode' in error) {
                    if ((error as { statusCode: number }).statusCode === 404) {
                        set.status = 404;
                        return {
                            status: "error",
                            message: "Time record not found"
                        };
                    }
                }
                throw error;
            }

        } catch (error: unknown) {
            // Type guard for objects with status property
            if (error && typeof error === 'object' && 'status' in error) {
                set.status = (error as { status: number }).status;
            } else {
                set.status = 500;
            }
            
            return {
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error occurred"
            };
        }
    });