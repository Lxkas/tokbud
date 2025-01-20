import Elysia from "elysia";
import { TimeRecordDoc, ShiftRecord } from "@/elysia/types/es";
import { esClient } from "@/elysia/utils/es";
import { getUserOrganization } from "@/elysia/services/clerk";
import { ES_IDX_TIME_RECORD } from "@/elysia/utils/const";
import { getActiveShifts, getTodayRegularShift } from "@/elysia/services/es";
import { jwtMiddleware } from "@/middleware";

interface TimeRecordBody {
    img_url: string;
    shift_time: string;
    reason?: string; // For overtime shifts
}

interface ElysiaTimeRecordContext {
    body: TimeRecordBody;
    jwt: {
        verify: (token: string) => Promise<{ sub: string } | null>
    };
    set: {
        status: number
    };
    cookie: {
        auth: {
            value: string
        }
    };
    params: {
        shift_type: string;
    };
}

interface EditTimeRecordBody {
    document_id: string;
    img_url_start?: string;
    img_url_end?: string;
    shift_start_time?: string;
    shift_end_time?: string;
    reason?: string;
}

interface ElysiaEditTimeRecordContext {
    body: EditTimeRecordBody;
    jwt: {
        verify: (token: string) => Promise<{ sub: string } | null>
    };
    set: {
        status: number
    };
    cookie: {
        auth: {
            value: string
        }
    };
}

export const timeRecordController = new Elysia({ prefix: "/time-record" })
    .use(jwtMiddleware)
    .post("/:shift_type/clock-in", async ({ body, jwt, set, cookie: { auth }, params }: ElysiaTimeRecordContext) => {
        try {
            const jwtPayload = await jwt.verify(auth.value);
            if (!jwtPayload) {
                set.status = 401;
                throw Error("Unauthorized");
            }

            const user_id = jwtPayload.sub;
            const { img_url, shift_time, reason } = body;
            const shift_type = params.shift_type as 'regular' | 'overtime';

            // Validate shift type
            if (!['regular', 'overtime'].includes(shift_type)) {
                return {
                    status: "error",
                    message: "Invalid shift type. Must be either 'regular' or 'overtime'",
                };
            }

            // Validate required fields
            if (!img_url || !shift_time || !reason) {
                return {
                    status: "error",
                    message: "Missing required fields: img_url, shift_time, and reason are required",
                };
            }

            // Get current date and time
            const now = new Date();
            const currentDate = now.toISOString().split("T")[0];
            const systemTime = now.toISOString();

            // Get organization info
            const clerkResponse = await getUserOrganization(user_id);
            if (!clerkResponse || !clerkResponse[0]?.organization?.id) {
                return {
                    status: "error",
                    message: "Could not find organization for this user",
                };
            }

            if (shift_type === 'regular') {
                // Check for today's shift first
                const todayShift = await getTodayRegularShift(user_id, currentDate);
                if (todayShift) {
                    const activeShifts = await getActiveShifts(user_id, 'regular');
                    const otherActiveShifts = activeShifts.filter(shift => shift.date !== currentDate);

                    return {
                        status: "error",
                        message: "You have already clocked in today",
                        data: {
                            document_id: todayShift.document_id,
                            date: todayShift.date,
                            ...(otherActiveShifts.length > 0 && {
                                warning: "You have incomplete regular shifts from other days",
                                active_shifts: otherActiveShifts
                            })
                        }
                    };
                }

                // Check for other active shifts even if no shift today
                const activeShifts = await getActiveShifts(user_id, 'regular');

                // Create the regular shift document
                const timeRecordDoc: TimeRecordDoc = {
                    user_id,
                    date: currentDate,
                    organization_id: clerkResponse[0].organization.id,
                    shift_type,
                    shifts: [{
                        start_time: {
                            system_time: systemTime,
                            image_url: img_url,
                            shift_time
                        }
                    }],
                    status: "incomplete",
                    shift_details: {  // Added shift_details for regular shifts
                        reason,
                        hours: 0
                    }
                };

                const result = await esClient.index({
                    index: ES_IDX_TIME_RECORD,
                    document: timeRecordDoc,
                });

                return {
                    status: "ok",
                    data: {
                        document_id: result._id,
                        ...(activeShifts.length > 0 && {
                            warning: "You have incomplete regular shifts from other days",
                            active_shifts: activeShifts
                        })
                    }
                };

            } else {
                // Generate shift_id for overtime
                const shift_id = `${user_id}_ot_${systemTime.replace(/[-:\.]/g, '').slice(0, 14)}`;

                // Create overtime document
                const timeRecordDoc: TimeRecordDoc = {
                    user_id,
                    date: currentDate,
                    organization_id: clerkResponse[0].organization.id,
                    shift_type,
                    shift_id,
                    shifts: [{
                        start_time: {
                            system_time: systemTime,
                            image_url: img_url,
                            shift_time
                        }
                    }],
                    status: "incomplete",
                    shift_details: {
                        reason,
                        hours: 0
                    }
                };

                const result = await esClient.index({
                    index: ES_IDX_TIME_RECORD,
                    document: timeRecordDoc,
                });

                // Check for other active overtime shifts
                const activeShifts = await getActiveShifts(user_id, 'overtime');
                const otherActiveShifts = activeShifts.filter(shift => shift.document_id !== result._id);
                
                return {
                    status: "ok",
                    data: {
                        document_id: result._id,
                        shift_id,
                        ...(otherActiveShifts.length > 0 && {
                            warning: "You have incomplete overtime shifts",
                            active_shifts: otherActiveShifts
                        })
                    }
                };
            }

        } catch (error) {
            return {
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error occurred",
            };
        }
    })
    .post("/:shift_type/clock-out", async ({ body, jwt, set, cookie: { auth }, params }: ElysiaTimeRecordContext & { body: TimeRecordBody & { document_id: string } }) => {
        try {
            const jwtPayload = await jwt.verify(auth.value);
            if (!jwtPayload) {
                set.status = 401;
                throw Error("Unauthorized");
            }

            const user_id = jwtPayload.sub;
            const { img_url, shift_time, document_id } = body;
            const shift_type = params.shift_type as 'regular' | 'overtime';

            // Validate shift type
            if (!['regular', 'overtime'].includes(shift_type)) {
                return {
                    status: "error",
                    message: "Invalid shift type. Must be either 'regular' or 'overtime'",
                };
            }

            // Validate required fields
            if (!img_url || !document_id || !shift_time) {
                return {
                    status: "error",
                    message: "Missing required fields: document_id, img_url, and shift_time are required",
                };
            }

            // Get the existing record
            try {
                const existingDoc = await esClient.get<TimeRecordDoc>({
                    index: ES_IDX_TIME_RECORD,
                    id: document_id
                });

                if (!existingDoc._source) {
                    return {
                        status: "error",
                        message: "Cannot find time record with the provided document ID",
                    };
                }

                // Verify record ownership and type
                if (existingDoc._source.user_id !== user_id) {
                    return {
                        status: "error",
                        message: "Document does not belong to this user",
                    };
                }

                if (existingDoc._source.shift_type !== shift_type) {
                    return {
                        status: "error",
                        message: `This is not a ${shift_type} shift record`,
                    };
                }

                if (existingDoc._source.status === 'complete') {
                    return {
                        status: "error",
                        message: "This shift is already completed",
                    };
                }

                // Validate start_time shift_time exists
                if (!existingDoc._source.shifts[0]?.start_time?.shift_time) {
                    return {
                        status: "error",
                        message: "`shift_time` is missing from `start_time` in the record",
                    };
                }

                // Validate end_time is after start_time
                const startTime = new Date(existingDoc._source.shifts[0].start_time.shift_time);
                const endTime = new Date(shift_time);

                if (endTime <= startTime) {
                    return {
                        status: "error",
                        message: `End time (${shift_time}) must be after start time (${existingDoc._source.shifts[0].start_time.shift_time})`,
                    };
                }

                // Prepare update document
                const now = new Date();
                const systemTime = now.toISOString();
                const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                
                const updateDoc = {
                    shifts: [{
                        ...existingDoc._source.shifts[0],
                        end_time: {
                            system_time: systemTime,
                            image_url: img_url,
                            shift_time
                        }
                    }],
                    status: 'complete',
                    shift_details: {
                        ...existingDoc._source.shift_details,
                        hours: parseFloat(hours.toFixed(2))
                    }
                };

                // Update the document
                await esClient.update({
                    index: ES_IDX_TIME_RECORD,
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
                if (error.statusCode === 404) {
                    return {
                        status: "error",
                        message: "Cannot find time record with the provided document ID",
                    };
                }
                throw error;
            }

        } catch (error) {
            return {
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error occurred",
            };
        }
    })
    .put("/edit", async ({ body, jwt, set, cookie: { auth } }: ElysiaEditTimeRecordContext) => {
        try {
            // Verify JWT token
            const jwtPayload = await jwt.verify(auth.value);
            if (!jwtPayload) {
                set.status = 401;
                throw Error("Unauthorized");
            }

            const user_id = jwtPayload.sub;
            const { document_id, img_url_start, img_url_end, shift_start_time, shift_end_time, reason } = body;

            // Validate document_id is provided
            if (!document_id) {
                return {
                    status: "error",
                    message: "document_id is required"
                };
            }

            // Check if any fields to update are provided
            if (!img_url_start && !img_url_end && !shift_start_time && !shift_end_time && !reason) {
                return {
                    status: "error",
                    message: "No fields to update provided"
                };
            }

            // Get the existing record
            try {
                const existingDoc = await esClient.get<TimeRecordDoc>({
                    index: ES_IDX_TIME_RECORD,
                    id: document_id
                });

                if (!existingDoc._source) {
                    return {
                        status: "error",
                        message: "Cannot find time record with the provided document ID"
                    };
                }

                // Verify record ownership
                if (existingDoc._source.user_id !== user_id) {
                    return {
                        status: "error",
                        message: "Document does not belong to this user"
                    };
                }

                const currentShift = existingDoc._source.shifts[0];
                if (!currentShift) {
                    return {
                        status: "error",
                        message: "Invalid shift data in record"
                    };
                }

                // Prepare update document with type assertion
                const updateDoc: { shifts: ShiftRecord[] } & Partial<TimeRecordDoc> = {
                    shifts: [{ ...currentShift }]
                };

                let warnings: string[] = [];
                let hours = existingDoc._source.shift_details?.hours || 0;

                // Handle time updates
                if (shift_start_time) {
                    if (!currentShift.start_time) {
                        return {
                            status: "error",
                            message: "Cannot update start time: No start time record exists"
                        };
                    }

                    updateDoc.shifts[0].start_time = {
                        ...currentShift.start_time,
                        shift_time: shift_start_time
                    };

                    // If end time is being updated too, use that for validation
                    // Otherwise use existing end time if it exists
                    if (shift_end_time) {
                        const startTime = new Date(shift_start_time);
                        const endTime = new Date(shift_end_time);
                        
                        if (endTime <= startTime) {
                            return {
                                status: "error",
                                message: `End time (${shift_end_time}) must be after start time (${shift_start_time})`
                            };
                        }
                        
                        hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                    } else if (currentShift.end_time) {
                        const startTime = new Date(shift_start_time);
                        const endTime = new Date(currentShift.end_time.shift_time);
                        
                        if (endTime <= startTime) {
                            return {
                                status: "error",
                                message: `End time (${currentShift.end_time.shift_time}) must be after start time (${shift_start_time})`
                            };
                        }
                        
                        hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                    } else {
                        warnings.push("Shift is not clocked out yet");
                    }
                }

                // Handle end time updates
                if (shift_end_time) {
                    if (!currentShift.end_time) {
                        return {
                            status: "error",
                            message: "Cannot update end time: No end time record exists"
                        };
                    }

                    updateDoc.shifts[0].end_time = {
                        ...currentShift.end_time,
                        shift_time: shift_end_time
                    };

                    // If start time wasn't provided in request, validate against existing start time
                    if (!shift_start_time) {
                        const startTime = new Date(currentShift.start_time.shift_time);
                        const endTime = new Date(shift_end_time);
                        
                        if (endTime <= startTime) {
                            return {
                                status: "error",
                                message: `End time (${shift_end_time}) must be after start time (${currentShift.start_time.shift_time})`
                            };
                        }

                        hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                    }
                    // If start time was provided, validation and hours calculation was already done above
                }

                // Update image URLs if provided
                if (img_url_start) {
                    if (!currentShift.start_time) {
                        return {
                            status: "error",
                            message: "Cannot update start image: No start time record exists"
                        };
                    }
                    updateDoc.shifts[0].start_time.image_url = img_url_start;
                }

                if (img_url_end) {
                    if (!currentShift.end_time) {
                        return {
                            status: "error",
                            message: "Cannot update end image: No end time record exists"
                        };
                    }
                    updateDoc.shifts[0].end_time = {
                        ...currentShift.end_time,
                        image_url: img_url_end
                    };
                }

                // Update reason if provided
                if (reason) {
                    updateDoc.shift_details = {
                        ...existingDoc._source.shift_details,
                        reason
                    };
                }

                // Update hours if changed
                if (hours !== existingDoc._source.shift_details?.hours) {
                    updateDoc.shift_details = {
                        ...updateDoc.shift_details,
                        ...existingDoc._source.shift_details,
                        hours: parseFloat(hours.toFixed(2))
                    };
                }

                // Update the document
                await esClient.update({
                    index: ES_IDX_TIME_RECORD,
                    id: document_id,
                    doc: updateDoc
                });

                return {
                    status: "ok",
                    data: {
                        document_id
                    },
                    ...(warnings.length > 0 && { warnings })
                };

            } catch (error: any) {
                if (error.statusCode === 404) {
                    return {
                        status: "error",
                        message: "Cannot find time record with the provided document ID"
                    };
                }
                throw error;
            }

        } catch (error) {
            return {
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error occurred"
            };
        }
    });