import Elysia from "elysia";
import { TimeRecordDoc } from "@/elysia/types/es";
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
            if (!img_url || !shift_time || (shift_type === 'overtime' && !reason)) {
                return {
                    status: "error",
                    message: shift_type === 'overtime' 
                        ? "Missing required fields: img_url, shift_time, and reason are required for overtime"
                        : "Missing required fields: img_url and shift_time are required",
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
                    status: "incomplete"
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
                    overtime_details: {
                        reason,
                        ot_hours: 0
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

                // Prepare update document
                const now = new Date();
                const systemTime = now.toISOString();
                
                const updateDoc: any = {
					'shifts': [{
						...existingDoc._source.shifts[0],
						end_time: {
							system_time: systemTime,
							image_url: img_url,
							shift_time
						}
					}],
					status: 'complete'
				};

                // Calculate OT hours for overtime shifts
                if (shift_type === 'overtime') {
					const startTime = new Date(existingDoc._source.shifts[0].start_time.system_time);
					const endTime = now;
					const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
					updateDoc.overtime_details = {
						...existingDoc._source.overtime_details,
						ot_hours: parseFloat(hours.toFixed(2))
					};
				}

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
    });