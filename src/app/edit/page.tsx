"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Shift {
	id: string;
	name: string;
	startTime: string;
	endTime: string;
}

interface ClockEvent {
	id: string;
	type: "in" | "out";
	timestamp: Date;
	userId: string;
	shiftId: string;
}

interface EditRecord {
	id: string;
	eventId: string;
	oldTimestamp: Date;
	newTimestamp: Date;
	editedAt: Date;
}

export default function EditTimePage() {
	const [shifts, setShifts] = useState<Shift[]>([
		{ id: "1", name: "Morning Shift", startTime: "06:00", endTime: "14:00" },
		{ id: "2", name: "Afternoon Shift", startTime: "14:00", endTime: "22:00" },
		{ id: "3", name: "Night Shift", startTime: "22:00", endTime: "06:00" },
	]);

	const [clockEvents, setClockEvents] = useState<ClockEvent[]>([
		{ id: "1", type: "in", timestamp: new Date("2023-05-01T06:00:00"), userId: "user1", shiftId: "1" },
		{ id: "2", type: "out", timestamp: new Date("2023-05-01T14:00:00"), userId: "user1", shiftId: "1" },
		{ id: "3", type: "in", timestamp: new Date("2023-05-01T14:00:00"), userId: "user2", shiftId: "2" },
		{ id: "4", type: "out", timestamp: new Date("2023-05-01T22:00:00"), userId: "user2", shiftId: "2" },
	]);

	const [editRecords, setEditRecords] = useState<EditRecord[]>([]);

	const [newShift, setNewShift] = useState<Omit<Shift, "id">>({ name: "", startTime: "", endTime: "" });

	const handleAddShift = () => {
		if (newShift.name && newShift.startTime && newShift.endTime) {
			setShifts([...shifts, { ...newShift, id: Date.now().toString() }]);
			setNewShift({ name: "", startTime: "", endTime: "" });
		}
	};

	const handleDeleteShift = (id: string) => {
		setShifts(shifts.filter((shift) => shift.id !== id));
	};

	const handleDeleteClockEvent = (id: string) => {
		setClockEvents(clockEvents.filter((event) => event.id !== id));
	};

	const handleEditClockEvent = (id: string, newTimestamp: string) => {
		const eventToEdit = clockEvents.find((event) => event.id === id);
		if (eventToEdit) {
			const oldTimestamp = eventToEdit.timestamp;
			const updatedTimestamp = parseISO(newTimestamp);

			setClockEvents(
				clockEvents.map((event) => (event.id === id ? { ...event, timestamp: updatedTimestamp } : event)),
			);

			const newEditRecord: EditRecord = {
				id: Date.now().toString(),
				eventId: id,
				oldTimestamp,
				newTimestamp: updatedTimestamp,
				editedAt: new Date(),
			};

			setEditRecords([...editRecords, newEditRecord]);
		}
	};

	return (
		<Tabs defaultValue="shifts" className="w-full">
			<TabsList>
				<TabsTrigger value="shifts">Shifts</TabsTrigger>
				<TabsTrigger value="clockEvents">Clock Events</TabsTrigger>
				<TabsTrigger value="editHistory">Edit History</TabsTrigger>
			</TabsList>
			<TabsContent value="shifts">
				<Card>
					<CardHeader>
						<CardTitle>Manage Shifts</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
							<Input
								placeholder="Shift Name"
								value={newShift.name}
								onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
							/>
							<Input
								type="time"
								placeholder="Start Time"
								value={newShift.startTime}
								onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
							/>
							<Input
								type="time"
								placeholder="End Time"
								value={newShift.endTime}
								onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
							/>
							<Button onClick={handleAddShift}>Add Shift</Button>
						</div>
						<ScrollArea className="h-[300px] w-full rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Start Time</TableHead>
										<TableHead>End Time</TableHead>
										<TableHead>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{shifts.map((shift) => (
										<TableRow key={shift.id}>
											<TableCell>{shift.name}</TableCell>
											<TableCell>{shift.startTime}</TableCell>
											<TableCell>{shift.endTime}</TableCell>
											<TableCell>
												<Button
													variant="destructive"
													onClick={() => handleDeleteShift(shift.id)}
												>
													Delete
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</ScrollArea>
					</CardContent>
				</Card>
			</TabsContent>
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
									{clockEvents.map((event) => (
										<TableRow key={event.id}>
											<TableCell>{event.userId}</TableCell>
											<TableCell>{event.type}</TableCell>
											<TableCell>
												<Dialog>
													<DialogTrigger asChild>
														<Button variant="outline">
															{format(event.timestamp, "yyyy-MM-dd HH:mm:ss")}
														</Button>
													</DialogTrigger>
													<DialogContent>
														<DialogHeader>
															<DialogTitle>Edit Timestamp</DialogTitle>
														</DialogHeader>
														<Input
															type="datetime-local"
															defaultValue={format(event.timestamp, "yyyy-MM-dd'T'HH:mm")}
															onChange={(e) =>
																handleEditClockEvent(event.id, e.target.value)
															}
														/>
													</DialogContent>
												</Dialog>
											</TableCell>
											<TableCell>{event.shiftId}</TableCell>
											<TableCell>
												<Button
													variant="destructive"
													onClick={() => handleDeleteClockEvent(event.id)}
												>
													Delete
												</Button>
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
											<TableCell>{format(record.oldTimestamp, "yyyy-MM-dd HH:mm:ss")}</TableCell>
											<TableCell>{format(record.newTimestamp, "yyyy-MM-dd HH:mm:ss")}</TableCell>
											<TableCell>{format(record.editedAt, "yyyy-MM-dd HH:mm:ss")}</TableCell>
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
