import Elysia from "elysia";
import { jwtMiddleware } from "@/middleware";
import { getUserOrganization } from "@/elysia/services/clerk";
import { esClient } from "@/elysia/utils/es";
import { ES_IDX_TIME_RECORD } from "@/elysia/utils/const";
import { TimeInfo, TimeRecordDoc, ElysiaClockInContext, ElysiaClockOutContext, ElysiaEditContext } from "@/elysia/types/time-record";
import { isValidUTCDateTime, createChangeLogJSON, convertToTimezone } from "@/elysia/utils/helpers";

export const timeRecordController2 = new Elysia({ prefix: "/time-record-2" })
    .use(jwtMiddleware)
    .post("/clock-in", async ({ body, jwt, set, cookie: { auth } }: ElysiaClockInContext) => {
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
            // const currentTimeUTC7 = convertToTimezone(currentTime, 7);
            const recordDateUTC7 = convertToTimezone(shift_time, 7).split('T')[0];

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
                date: recordDateUTC7,
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
                        message: `End time (${endTime.toISOString()}) must be after start time (${startTime.toISOString()})`,
                    };
                }

                // Prepare end time info
                const currentTime = new Date().toISOString();
                // const currentTimeUTC7 = convertToTimezone(currentTime, 7);
                const endTimeInfo: TimeInfo = {
                    shift_time,
                    timestamp: currentTime,
                    image_url,
                    lat,
                    lon
                };

                // Prepare start time info
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
    })
    .put("/edit", async ({ body, jwt, set, cookie: { auth } }: ElysiaEditContext) => {
        console.log("put api hit")
        try {
            console.log("put api hit try block")
            // Verify JWT and get user_id
            const jwtPayload = await jwt.verify(auth.value);
            if (!jwtPayload) {
                set.status = 401;
                throw Error("Unauthorized");
            }
    
            const user_id = jwtPayload.sub;
            const { 
                document_id, 
                edit_reason, 
                lat, 
                lon,
                shift_reason,
                image_url_start,
                image_url_end,
                official_start_time,
                official_end_time,
                start_time,
                end_time
            } = body;
    
            // Validate mandatory fields
            const mandatoryFields = ['document_id', 'edit_reason', 'lat', 'lon'];
            const missingFields = mandatoryFields.filter(field => !(field in body));
    
            if (missingFields.length > 0) {
                set.status = 400;
                return {
                    status: "error",
                    message: `Missing mandatory fields: ${missingFields.join(', ')}`
                };
            }
    
            // Validate datetime formats if provided
            const validateDateTime = (time: string) => isValidUTCDateTime(time);
            
            const timesToValidate = {
                official_start_time,
                official_end_time,
                start_time,
                end_time
            };
    
            for (const [key, value] of Object.entries(timesToValidate)) {
                if (value && !validateDateTime(value)) {
                    set.status = 400;
                    return {
                        status: "error",
                        message: `Invalid ${key} format. Expected format: 2024-01-25T08:30:45.123Z`
                    };
                }
            }
    
            // Get existing document
            const existingDoc = await esClient.get<TimeRecordDoc>({
                index: ES_IDX_TIME_RECORD,
                id: document_id
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
                    message: "You are not authorized to edit this record"
                };
            }
    
            // Check existence of fields that need to be edited
            if (official_start_time || start_time || image_url_start) {
                if (!existingDoc._source.start_time) {
                    set.status = 400;
                    return {
                        status: "error",
                        message: "Cannot edit start time: No start time record exists"
                    };
                }
            }
    
            if (official_end_time || end_time || image_url_end) {
                if (!existingDoc._source.end_time) {
                    set.status = 400;
                    return {
                        status: "error",
                        message: "Cannot edit end time: No end time record exists"
                    };
                }
            }
    
            if (shift_reason) {
                if (!existingDoc._source.reason) {
                    set.status = 400;
                    return {
                        status: "error",
                        message: "Cannot edit shift reason: No 'reason' record exists"
                    };
                }
            }
    
            // Time sequence validation
            if ((official_start_time || start_time) && (official_end_time || end_time)) {
                // If both times are provided in request, validate them against each other
                const newStartTime = new Date(official_start_time ?? start_time!);  // Using nullish coalescing and non-null assertion
                const newEndTime = new Date(official_end_time ?? end_time!);

                if (newEndTime <= newStartTime) {
                    set.status = 400;
                    return {
                        status: "error",
                        message: `End time (${newEndTime.toISOString()}) must be after start time (${newStartTime.toISOString()})`,
                    };
                }
            } else if (official_start_time || start_time) {
                // If only start time is provided, check against existing end time
                if (existingDoc._source.end_time) {
                    const newStartTime = new Date(official_start_time ?? start_time!);
                    const existingEndTime = new Date(existingDoc._source.end_time.shift_time);
                    
                    if (existingEndTime <= newStartTime) {
                        set.status = 400;
                        return {
                            status: "error",
                            message: `New start time (${newStartTime.toISOString()}) must be before existing end time (${existingEndTime.toISOString()})`
                        };
                    }
                }
            } else if (official_end_time || end_time) {
                // If only end time is provided, check against existing start time
                if (!existingDoc._source.start_time) {
                    set.status = 400;
                    return {
                        status: "error",
                        message: "Cannot update end time: Start time record must exist first"
                    };
                }

                const existingStartTime = new Date(existingDoc._source.start_time.shift_time);
                const newEndTime = new Date(official_end_time ?? end_time!);
                
                if (newEndTime <= existingStartTime) {
                    set.status = 400;
                    return {
                        status: "error",
                        message: `New end time (${newEndTime.toISOString()}) must be after existing start time (${existingStartTime.toISOString()})`
                    };
                }
            }
    
            // Prepare update document
            const updateDoc: Partial<TimeRecordDoc> = {};
    
            // Update start time if needed
            if (official_start_time || start_time || image_url_start) {
                const startTimeInfo: TimeInfo = {
                    ...existingDoc._source.start_time,
                    ...(official_start_time && { shift_time: official_start_time }),
                    ...(start_time && { timestamp: start_time }),
                    ...(image_url_start && { image_url: image_url_start })
                };
                updateDoc.start_time = startTimeInfo;
            }
    
            // Update end time if needed
            if (official_end_time || end_time || image_url_end) {
                const endTimeInfo: TimeInfo = {
                    ...existingDoc._source.end_time!,
                    ...(official_end_time && { shift_time: official_end_time }),
                    ...(end_time && { timestamp: end_time }),
                    ...(image_url_end && { image_url: image_url_end })
                };
                updateDoc.end_time = endTimeInfo;
            }
    
            // Update reason if provided
            if (shift_reason !== undefined) {
                updateDoc.reason = shift_reason;
            }
    
            // Create change log entry
            const changeLogEntry = createChangeLogJSON({
                isSystem: false,
                edit_reason: edit_reason,
                lat: lat,
                lon: lon,
                startTimeInfo: updateDoc.start_time || existingDoc._source.start_time,
                endTimeInfo: updateDoc.end_time || existingDoc._source.end_time || null,
                shift_reason: updateDoc.reason || existingDoc._source.reason
            });
    
            // Update the document
            await esClient.update({
                index: ES_IDX_TIME_RECORD,
                id: document_id,
                doc: {
                    ...updateDoc,
                    change_log: [...existingDoc._source.change_log, changeLogEntry]
                }
            });
    
            return {
                status: "success",
                data: {
                    document_id
                }
            };
    
        } catch (error: unknown) {
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