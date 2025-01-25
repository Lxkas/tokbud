"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, LogIn, LogOut } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ClockEvent {
	type: "in" | "out";
	shift: string;
	timestamp: Date;
}

interface Shift {
	id: string;
	name: string;
	startTime: string;
	endTime: string;
}

function formatDate(date: Date | undefined, formatString: string) {
	if (!date) return "Loading...";
	return format(date, formatString);
}

// PLACEHOLDER!
const mockApi = {
	fetchShifts: async (): Promise<Shift[]> => {
		return [
			{ id: "1", name: "Morning Shift", startTime: "06:00", endTime: "14:00" },
			{ id: "2", name: "Afternoon Shift", startTime: "14:00", endTime: "22:00" },
			{ id: "3", name: "Night Shift", startTime: "22:00", endTime: "06:00" },
		];
	},

	// TODO: mission critical. Add a lot of error handling and state recovery in the event of a failure.
	saveEvent: async (event: ClockEvent): Promise<void> => {
		console.log("Event saved:", event);
	},
};

export default function TimeTracker() {
	const [currentTime, setCurrentTime] = useState<Date>();
	const [isClockedIn, setIsClockedIn] = useState(false);
	const [events, setEvents] = useState<ClockEvent[]>([]);
	const [selectedShift, setSelectedShift] = useState<string | "">("");
	const [shifts, setShifts] = useState<Shift[]>([]);

	useEffect(() => {
		setCurrentTime(new Date());

		const timer = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		async function loadShifts() {
			const fetchedShifts = await mockApi.fetchShifts();
			setShifts(fetchedShifts);
		}

		loadShifts();
	}, []);

	const handleClockInOut = async () => {
		if (!isClockedIn && !selectedShift) {
			alert("Please select a shift before clocking in.");
			return;
		}

		const newEvent: ClockEvent = {
			type: isClockedIn ? "out" : "in",
			shift: selectedShift,
			timestamp: new Date(),
		};

		// this should be optimistic
		setEvents([newEvent, ...events]);
		setIsClockedIn(!isClockedIn);

		if (isClockedIn) {
			setSelectedShift("");
		}

		await mockApi.saveEvent(newEvent);
	};

	return (
		<Card className="w-full max-w-md mx-auto">
			<CardHeader>
				<CardTitle className="text-2xl font-bold">Time Tracker</CardTitle>
				<CardDescription>Select your shift and clock in/out to track your work hours</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex items-center justify-between mb-6">
					<div className="flex items-center space-x-2">
						<Clock className="w-5 h-5" />
						<span className="text-lg font-semibold">{formatDate(currentTime, "h:mm:ss a")}</span>
					</div>
					<span className="text-sm">{formatDate(currentTime, "EEEE, MMMM d, yyyy")}</span>
				</div>
				<div className="space-y-4 mb-6">
					<div className="space-y-2">
						<Label htmlFor="shift-select">Select Shift</Label>
						<Select
							disabled={isClockedIn}
							onValueChange={(value) => setSelectedShift(value)}
							value={selectedShift}
						>
							<SelectTrigger id="shift-select">
								<SelectValue placeholder="Choose your shift" />
							</SelectTrigger>
							<SelectContent>
								{shifts.map((shift) => (
									<SelectItem key={shift.id} value={shift.id}>
										{shift.name} ({shift.startTime} - {shift.endTime})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{!isClockedIn && !selectedShift && (
							<p className="text-sm text-yellow-600 dark:text-yellow-400">
								Please select a shift before clocking in.
							</p>
						)}
					</div>
					<div className="flex items-center justify-between">
						<span className="text-lg font-semibold">Status:</span>
						<span className={`text-lg font-bold ${isClockedIn ? "text-green-500" : "text-red-500"}`}>
							{isClockedIn
								? `Clocked In (${shifts.find((s) => s.id === selectedShift)?.name})`
								: "Clocked Out"}
						</span>
					</div>
				</div>
				<Button onClick={handleClockInOut} className="w-full" disabled={!isClockedIn && !selectedShift}>
					{isClockedIn ? (
						<>
							<LogOut className="w-4 h-4 mr-2" /> Clock Out
						</>
					) : (
						<>
							<LogIn className="w-4 h-4 mr-2" />
							{selectedShift ? "Clock In" : "Select a shift to Clock In"}
						</>
					)}
				</Button>
				{!isClockedIn && !selectedShift && (
					<p className="text-sm text-muted-foreground mt-2 text-center">
						Select a shift above to enable clock in.
					</p>
				)}
			</CardContent>
			<CardFooter>
				<div className="w-full">
					<h3 className="text-lg font-semibold mb-2">Recent Activity</h3>
					<ScrollArea className="h-[200px] w-full rounded-md border p-4">
						{events.map((event, index) => (
							<div key={index} className="flex justify-between items-center mb-2">
								<span className="font-medium">
									{event.type === "in" ? "Clocked In" : "Clocked Out"} (
									{shifts.find((s) => s.id === event.shift)?.name})
								</span>
								<span className="text-sm text-muted-foreground">
									{formatDate(event.timestamp, "h:mm:ss a")}
								</span>
							</div>
						))}
					</ScrollArea>
				</div>
			</CardFooter>
		</Card>
	);
}
