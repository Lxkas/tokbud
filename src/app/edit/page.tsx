"use client";

import { useState, useEffect, useTransition } from "react";
import { useSession } from "@clerk/nextjs";
import { elysia } from "@/elysia/client";
import { setCookie } from "cookies-next";
import { WorkingHourResponse } from "@/elysia/types/working-hours";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface TimeInfo {
	shift_time: string;
	timestamp: string;
	image_url: string;
	lat: number;
	lon: number;
}

interface TimeRecordDoc {
	date: string;
	user_id: string;
	org_id: string;
	shift_type: string;
	is_complete: boolean;
	reason: string;
	start_time: TimeInfo;
	end_time: TimeInfo | null;
	change_log: any[];
}

interface EditRecord {
	id: string;
	eventId: string;
	oldTimestamp: string;
	newTimestamp: string;
	editedAt: string;
}

export default function EditTimePage() {
	const [timeRecords, setTimeRecords] = useState<TimeRecordDoc[]>([]);
	const [editRecords, setEditRecords] = useState<EditRecord[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const { isSignedIn, session } = useSession();

	useEffect(() => {
		if (!isSignedIn) {
			setTimeRecords([]);
			setEditRecords([]);
			return;
		}

		fetchTimeRecords().catch((err) => {
			console.error("Failed to fetch time records:", err);
			setError("Failed to load time records");
		});
	}, [isSignedIn]);

	async function fetchTimeRecords() {
		try {
			setLoading(true);
			const jwt = await session?.getToken({ template: "Auth" });
			if (!jwt) return;

			setCookie("auth", jwt);

			const today = format(new Date(), "yyyy-MM-dd");
			const response = await elysia.api["working-hours"]["detail"].get({
				query: {
					start_date: today,
					end_date: today,
				},
			});

			if (!response.data) {
				console.error("No data from /working-hours/detail:", response);
				return;
			}

			const result = response.data as WorkingHourResponse;
			if (result.status === "error") {
				throw new Error("Failed to fetch time records");
			}

			const allRecords = result.data || [];

			if (allRecords.length > 0 && allRecords[0].all_shift) {
				const timeRecords = allRecords[0].all_shift.flatMap((day: any) =>
					(day.shift || []).map((shift: any) => ({
						date: day.date,
						user_id: shift.user_id,
						org_id: shift.org_id,
						shift_type: shift.shift_type,
						is_complete: shift.is_complete,
						reason: shift.reason,
						start_time: shift.start_time,
						end_time: shift.end_time,
						change_log: shift.change_log || [],
					})),
				);
				setTimeRecords(timeRecords);
			}
		} finally {
			setLoading(false);
		}
	}

	const handleEditTimeRecord = async (docId: string, newTimestamp: string, isStartTime: boolean) => {
		if (!isSignedIn) {
			setError("Please sign in to edit time records");
			return;
		}

		try {
			startTransition(() => {
				setLoading(true);
				setError(null);
			});

			const jwt = await session?.getToken({ template: "Auth" });
			if (!jwt) {
				throw new Error("No valid token found. Please sign in again.");
			}

			setCookie("auth", jwt);

			const response = await elysia.api["time-record-2"].edit.put({
				document_id: docId,
				edit_reason: "Manual time edit",
				lat: 0,
				lon: 0,
				...(isStartTime
					? {
							official_start_time: newTimestamp,
						}
					: {
							official_end_time: newTimestamp,
						}),
			});

			if (!response.data) {
				throw new Error("Failed to edit time record");
			}

			// Update local state
			setTimeRecords((prevRecords) =>
				prevRecords.map((record) => {
					if (record.date === docId) {
						const updatedRecord = { ...record };
						if (isStartTime) {
							updatedRecord.start_time.shift_time = newTimestamp;
						} else if (updatedRecord.end_time) {
							updatedRecord.end_time.shift_time = newTimestamp;
						}
						return updatedRecord;
					}
					return record;
				}),
			);

			// Add to edit history
			const newEditRecord: EditRecord = {
				id: Date.now().toString(),
				eventId: docId,
				oldTimestamp: isStartTime
					? timeRecords.find((r) => r.date === docId)?.start_time.shift_time || ""
					: timeRecords.find((r) => r.date === docId)?.end_time?.shift_time || "",
				newTimestamp,
				editedAt: new Date().toISOString(),
			};

			setEditRecords((prev) => [...prev, newEditRecord]);
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Tabs defaultValue="shifts" className="w-full">
			<TabsList>
				<TabsTrigger value="clockEvents">Time Records</TabsTrigger>
				<TabsTrigger value="editHistory">Edit History</TabsTrigger>
			</TabsList>
			<TabsContent value="clockEvents">
				<Card>
					<CardHeader>
						<CardTitle>Manage Clock Events</CardTitle>
					</CardHeader>
					<CardContent>
						<ScrollArea className="h-[400px] w-full rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>User ID</TableHead>
										<TableHead>Type</TableHead>
										<TableHead>Timestamp</TableHead>
										<TableHead>Shift ID</TableHead>
										<TableHead>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{timeRecords.map((record) => (
										<TableRow key={record.date}>
											<TableCell>{record.user_id}</TableCell>
											<TableCell>{record.shift_type}</TableCell>
											<TableCell>
												<Dialog>
													<DialogTrigger asChild>
														<Button variant="outline">
															{format(
																parseISO(record.start_time.shift_time),
																"yyyy-MM-dd HH:mm:ss",
															)}
														</Button>
													</DialogTrigger>
													<DialogContent>
														<DialogHeader>
															<DialogTitle>Edit Start Time</DialogTitle>
														</DialogHeader>
														<Input
															type="datetime-local"
															defaultValue={format(
																parseISO(record.start_time.shift_time),
																"yyyy-MM-dd'T'HH:mm",
															)}
															onChange={(e) =>
																handleEditTimeRecord(record.date, e.target.value, true)
															}
														/>
													</DialogContent>
												</Dialog>
											</TableCell>
											<TableCell>
												{record.end_time && (
													<Dialog>
														<DialogTrigger asChild>
															<Button variant="outline">
																{format(
																	parseISO(record.end_time.shift_time),
																	"yyyy-MM-dd HH:mm:ss",
																)}
															</Button>
														</DialogTrigger>
														<DialogContent>
															<DialogHeader>
																<DialogTitle>Edit End Time</DialogTitle>
															</DialogHeader>
															<Input
																type="datetime-local"
																defaultValue={format(
																	parseISO(record.end_time.shift_time),
																	"yyyy-MM-dd'T'HH:mm",
																)}
																onChange={(e) =>
																	handleEditTimeRecord(
																		record.date,
																		e.target.value,
																		false,
																	)
																}
															/>
														</DialogContent>
													</Dialog>
												)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</ScrollArea>
					</CardContent>
				</Card>
			</TabsContent>
			<TabsContent value="editHistory">
				<Card>
					<CardHeader>
						<CardTitle>Edit History</CardTitle>
					</CardHeader>
					<CardContent>
						<ScrollArea className="h-[400px] w-full rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Event ID</TableHead>
										<TableHead>Old Timestamp</TableHead>
										<TableHead>New Timestamp</TableHead>
										<TableHead>Edited At</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{editRecords.map((record) => (
										<TableRow key={record.id}>
											<TableCell>{record.eventId}</TableCell>
											<TableCell>
												{format(parseISO(record.oldTimestamp), "yyyy-MM-dd HH:mm:ss")}
											</TableCell>
											<TableCell>
												{format(parseISO(record.newTimestamp), "yyyy-MM-dd HH:mm:ss")}
											</TableCell>
											<TableCell>
												{format(parseISO(record.editedAt), "yyyy-MM-dd HH:mm:ss")}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</ScrollArea>
					</CardContent>
				</Card>
			</TabsContent>
		</Tabs>
	);
}
