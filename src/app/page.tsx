"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, LogIn, LogOut, Camera } from "lucide-react";
import { CameraCapture } from "@/components/camera-capture";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// 1) Import your typed Elysia client
import { elysia } from "@/elysia/client";

// 2) Import Clerk hooks for auth
import { useSession, useUser } from "@clerk/nextjs";
import { WorkingHourResponse } from "@/elysia/types/working-hours";

interface ClockEvent {
	type: "in" | "out";
	shiftType: "on-site" | "wfh" | "overtime";
	reason?: string;
	timestamp: Date;
	docId?: string;
}

function formatDate(date: Date | undefined, formatString: string) {
	if (!date) return "Loading...";
	return format(date, formatString);
}

export default function TimeTracker() {
	const [currentTime, setCurrentTime] = useState<Date>();

	// State for camera and photo
	const [showCamera, setShowCamera] = useState(false);
	const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
	const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);

	// State for clock in/out status and loading
	const [isClockedIn, setIsClockedIn] = useState(false);
	const [docId, setDocId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isLoadingShiftData, setIsLoadingShiftData] = useState(true);
	const [isPending, startTransition] = useTransition();

	// For the shift type and overtime reason
	const [shiftType, setShiftType] = useState<"on-site" | "wfh" | "overtime">("on-site");
	const [overtimeReason, setOvertimeReason] = useState("");

	// Recent activity events
	const [events, setEvents] = useState<ClockEvent[]>([]);

	// Auth
	const { isSignedIn, session } = useSession();

	// Update time every second
	useEffect(() => {
		const timer = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(timer);
	}, []);

	// Initial data fetch when component mounts or auth state changes
	useEffect(() => {
		if (!isSignedIn) {
			setIsClockedIn(false);
			setDocId(null);
			setOvertimeReason("");
			setEvents([]);
			setIsLoading(false);
			return;
		}

		fetchShiftStatus()
			.catch((err) => {
				console.error("Failed to fetch shift status:", err);
				alert("Failed to load your shift status. Please try refreshing the page.");
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, [isSignedIn]);

	// ------------------------------------------------
	//     Fetch the user's latest shift + all events
	// ------------------------------------------------
	async function fetchShiftStatus() {
		setIsLoadingShiftData(true);

		const jwt = await session?.getToken({ template: "Auth" });
		if (!jwt) return;

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
		const allRecords = Array.isArray(result.data) ? result.data : [];

		if (!allRecords.length) {
			// No record => user is.. clocked out?
			setIsClockedIn(false);
			setDocId(null);
			setShiftType("on-site");
			setOvertimeReason("");
			setEvents([]);
			setIsLoadingShiftData(false);
			return;
		}

		// should only be 1 object for this user, pick first
		const userRecord = allRecords[0];

		if (!userRecord?.all_shift?.length) {
			// No shifts at all => user clocked out
			setIsClockedIn(false);
			setDocId(null);
			setShiftType("on-site");
			setOvertimeReason("");
			setEvents([]);
			return;
		}

		// 1) Identify the LATEST SHIFT => all_shift[0].shift[0]
		//    We assume the server sorted `all_shift` so index=0 is the newest day,
		//    and that day's `shift` array is also sorted so shift[0] is the newest shift
		const newestDay = userRecord.all_shift[0];
		const latestShift = newestDay.shift?.[0];

		if (latestShift) {
			const { doc_id, is_complete, shift_type, reason, start_time, end_time } = latestShift;

			if (!is_complete) {
				// The newest shift is incomplete => user is clocked in
				setIsClockedIn(true);
				setDocId(doc_id || null);

				//@ts-ignore - too lazy rn
				setShiftType(shift_type || "on-site");

				setOvertimeReason(shift_type === "overtime" && reason ? reason : "");
			} else {
				// The newest shift is complete => user is clocked out
				setIsClockedIn(false);
				setDocId(null);
				setShiftType("on-site");
				setOvertimeReason("");
			}
		} else {
			// No shift data => user clocked out
			setIsClockedIn(false);
			setDocId(null);
			setShiftType("on-site");
			setOvertimeReason("");
		}

		// 2) Build "recent activity" from entire data set
		const newEvents: ClockEvent[] = [];

		// For each day in all_shift
		userRecord.all_shift.forEach((dayObj: any) => {
			const shiftArr = dayObj.shift || [];
			shiftArr.forEach((shift: any) => {
				const docId = shift.doc_id;
				const shiftType = shift.shift_type as "on-site" | "wfh" | "overtime";
				const reason = shift.reason;
				const isComplete = shift.is_complete;

				// If there's a start_time, create a "Clock In" event
				if (shift.start_time?.timestamp) {
					newEvents.push({
						type: "in",
						shiftType,
						reason,
						timestamp: new Date(shift.start_time.timestamp),
						docId,
					});
				}

				// If there's an end_time, create a "Clock Out" event
				// (only if the shift is complete)
				if (isComplete && shift.end_time?.timestamp) {
					newEvents.push({
						type: "out",
						shiftType,
						reason,
						timestamp: new Date(shift.end_time.timestamp),
					});
				}
			});
		});

		// Sort events in descending time (newest first)
		newEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
		setEvents(newEvents);

		setIsLoadingShiftData(false);
	}

	// Handle clock in with optimistic update
	const handlePhotoCapture = useCallback((imageDataUrl: string) => {
		setPhotoDataUrl(imageDataUrl);
		setShowCamera(false);
		setIsCapturingPhoto(false);
	}, []);

	const handleClockIn = async () => {
		if (!isSignedIn) {
			alert("Please sign in to clock in.");
			return;
		}

		if (!shiftType) {
			alert("Please select a shift type before clocking in.");
			return;
		}

		if (shiftType === "overtime" && !overtimeReason.trim()) {
			alert("Please provide a reason for overtime.");
			return;
		}

		if (!photoDataUrl) {
			setIsCapturingPhoto(true);
			setShowCamera(true);
			return;
		}

		// Start loading state
		startTransition(() => {
			// Optimistically update UI
			setIsClockedIn(true);
			const now = new Date();
			setEvents((prev) => [
				{
					type: "in",
					shiftType,
					reason: shiftType === "overtime" ? overtimeReason : undefined,
					timestamp: now,
				},
				...prev,
			]);
		});

		try {
			const jwt = await session?.getToken({ template: "Auth" });
			if (!jwt) {
				throw new Error("No valid token found. Please sign in again.");
			}

			const payload = {
				shift_type: shiftType,
				reason: shiftType === "overtime" ? overtimeReason : undefined,
				shift_time: new Date().toISOString(),
				image_url: "urmum",
				lat: 13.8445,
				lon: 100.5802,
			};

			const response = await elysia.api["time-record-2"]["clock-in"].post(payload, {
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${jwt}`,
				},
			});

			const respData = response.data;
			if (!respData || !respData.data?.document_id) {
				throw new Error(respData?.message || "Unknown server error");
			}

			// Update doc ID after successful clock in
			setDocId(respData.data.document_id);
		} catch (error: any) {
			// Revert optimistic updates on error
			setIsClockedIn(false);
			setEvents((prev) => prev.slice(1));
			alert(`Clock in failed: ${error.message}`);
		}
	};

	// Handle clock out with optimistic update
	const handleClockOut = async () => {
		if (!isSignedIn) {
			alert("Please sign in to clock out.");
			return;
		}

		if (!docId) {
			alert("Cannot clock out without a valid doc_id.");
			return;
		}

		if (!photoDataUrl) {
			setIsCapturingPhoto(true);
			setShowCamera(true);
			return;
		}

		// Start loading state
		startTransition(() => {
			// Optimistically update UI
			setIsClockedIn(false);
			const now = new Date();
			setEvents((prev) => [
				{
					type: "out",
					shiftType,
					reason: shiftType === "overtime" ? overtimeReason : undefined,
					timestamp: now,
				},
				...prev,
			]);
		});

		try {
			const jwt = await session?.getToken({ template: "Auth" });
			if (!jwt) {
				throw new Error("No valid token found. Please sign in again.");
			}

			const payload = {
				doc_id: docId,
				shift_time: new Date().toISOString(),
				image_url: photoDataUrl,
				lat: 13.8445,
				lon: 100.5802,
			};

			const response = await elysia.api["time-record-2"]["clock-out"].post(payload, {
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${jwt}`,
				},
			});

			const respData = response.data;
			if (!respData || !respData.data?.doc_id) {
				throw new Error(respData?.message || "Unknown server error");
			}

			// Clear doc ID after successful clock out
			setDocId(null);
		} catch (error: any) {
			// Revert optimistic updates on error
			setIsClockedIn(true);
			setEvents((prev) => prev.slice(1));
			alert(`Clock out failed: ${error.message}`);
		}
	};

	// Single button to toggle clock-in / clock-out
	const handleClockInOut = async () => {
		if (isClockedIn) {
			await handleClockOut();
		} else {
			await handleClockIn();
		}
	};

	// Reset photo when clock action completes
	useEffect(() => {
		if (!isPending) {
			setPhotoDataUrl(null);
		}
	}, [isPending]);

	if (showCamera) {
		return (
			<CameraCapture
				onCapture={handlePhotoCapture}
				onClose={() => {
					setShowCamera(false);
					setIsCapturingPhoto(false);
					setPhotoDataUrl(null);
				}}
			/>
		);
	}

	return (
		<Card className="w-full max-w-md mx-auto">
			<CardHeader>
				<CardTitle className="text-2xl font-bold">Time Tracker</CardTitle>
				<CardDescription>Select your shift type and clock in/out</CardDescription>
			</CardHeader>
			<CardContent>
				{/* Current Time Display */}
				<div className="flex items-center justify-between mb-6">
					<div className="flex items-center space-x-2">
						<Clock className="w-5 h-5" />
						<span className="text-lg font-semibold">{formatDate(currentTime, "h:mm:ss a")}</span>
					</div>
					<span className="text-sm">{formatDate(currentTime, "EEEE, MMMM d, yyyy")}</span>
				</div>

				{/* Shift Type Selection */}
				<div className="space-y-4 mb-6">
					<div className="space-y-2">
						<Label htmlFor="shift-select">Shift Type</Label>
						<Select
							disabled={isClockedIn}
							onValueChange={(value) => setShiftType(value as "on-site" | "wfh" | "overtime")}
							value={shiftType}
						>
							<SelectTrigger id="shift-select">
								<SelectValue placeholder="Choose your shift type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="on-site">On-Site</SelectItem>
								<SelectItem value="wfh">WFH</SelectItem>
								<SelectItem value="overtime">Overtime</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Show reason only if overtime */}
					{shiftType === "overtime" && (
						<div className="space-y-2">
							<Label htmlFor="overtime-reason">Overtime Reason</Label>
							<Input
								id="overtime-reason"
								value={overtimeReason}
								onChange={(e) => setOvertimeReason(e.target.value)}
								disabled={isClockedIn}
								placeholder="e.g. [USER] working for OT"
							/>
						</div>
					)}

					{/* Status Display */}
					<div className="flex items-center justify-between">
						<span className="text-lg font-semibold">Status:</span>
						<span className={`text-lg font-bold ${isClockedIn ? "text-green-500" : "text-red-500"}`}>
							{isClockedIn ? `Clocked In (${shiftType})` : "Clocked Out"}
						</span>
					</div>
				</div>

				{/* Photo Preview */}
				{photoDataUrl && (
					<div className="mb-4">
						<img src={photoDataUrl} alt="Captured selfie" className="w-full h-48 object-cover rounded-lg" />
					</div>
				)}

				{/* Clock-in/out Button */}
				<Button
					onClick={handleClockInOut}
					className="w-full"
					disabled={
						!isSignedIn ||
						(!isClockedIn && !shiftType) ||
						isPending ||
						isLoadingShiftData ||
						isCapturingPhoto
					}
				>
					{isLoading ? (
						"Loading..."
					) : isPending ? (
						isClockedIn ? (
							"Clocking out..."
						) : (
							"Clocking in..."
						)
					) : isCapturingPhoto ? (
						<>
							<Camera className="w-4 h-4 mr-2" />
							Take Selfie
						</>
					) : isClockedIn ? (
						<>
							<LogOut className="w-4 h-4 mr-2" />
							Clock Out
						</>
					) : (
						<>
							<LogIn className="w-4 h-4 mr-2" />
							Clock In
						</>
					)}
				</Button>

				{/* If no shift type selected & not clocked in */}
				{!isClockedIn && !shiftType && (
					<p className="text-sm text-muted-foreground mt-2 text-center">
						Select a shift type above to enable clock in.
					</p>
				)}
			</CardContent>

			<CardFooter>
				<div className="w-full">
					<h3 className="text-lg font-semibold mb-2">Recent Activity</h3>
					<ScrollArea className="h-[200px] w-full rounded-md border p-4">
						{isLoading ? (
							<div className="flex justify-center items-center h-full">
								<span className="text-muted-foreground">Loading activity...</span>
							</div>
						) : events.length === 0 ? (
							<div className="flex justify-center items-center h-full">
								<span className="text-muted-foreground">No recent activity</span>
							</div>
						) : (
							events.map((event, index) => (
								<div key={index} className="flex justify-between items-center mb-2">
									<span className="font-medium">
										{event.type === "in" ? "Clocked In" : "Clocked Out"} ({event.shiftType}
										{event.shiftType === "overtime" && event.reason ? ` / ${event.reason}` : ""})
									</span>
									<span className="text-sm text-muted-foreground">
										{formatDate(event.timestamp, "h:mm:ss a")}
									</span>
								</div>
							))
						)}
					</ScrollArea>
				</div>
			</CardFooter>
		</Card>
	);
}
