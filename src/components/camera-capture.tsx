"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface CameraCaptureProps {
	onCapture: (imageDataUrl: string) => void;
	onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [error, setError] = useState<string>("");

	const startCamera = useCallback(async () => {
		try {
			const mediaStream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: "user" },
				audio: false,
			});
			setStream(mediaStream);
			if (videoRef.current) {
				videoRef.current.srcObject = mediaStream;
			}
			setError("");
		} catch (err) {
			setError("Failed to access camera. Please ensure camera permissions are granted.");
			console.error("Camera access error:", err);
		}
	}, []);

	const stopCamera = useCallback(() => {
		if (stream) {
			stream.getTracks().forEach((track) => track.stop());
			setStream(null);
		}
	}, [stream]);

	const capturePhoto = useCallback(() => {
		if (videoRef.current && canvasRef.current) {
			const video = videoRef.current;
			const canvas = canvasRef.current;

			// Set canvas dimensions to match video (might have problems later idk)
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;

			// Draw the video frame to canvas
			const context = canvas.getContext("2d");
			if (context) {
				context.drawImage(video, 0, 0, canvas.width, canvas.height);

				// Convert to data URL
				const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8);
				onCapture(imageDataUrl);
				stopCamera();
			}
		}
	}, [onCapture, stopCamera]);

	// Start camera when component mounts
	useEffect(() => {
		startCamera();

		return () => {
			stopCamera();
		};
	}, [startCamera]);

	return (
		<Card className="p-4 w-full max-w-md mx-auto">
			{error ? (
				<div className="text-center space-y-4">
					<p className="text-red-500">{error}</p>
					<Button onClick={onClose}>Close</Button>
				</div>
			) : (
				<div className="space-y-4">
					<div className="relative aspect-video bg-black rounded-lg overflow-hidden">
						<video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
						<canvas ref={canvasRef} className="hidden" />
					</div>

					<div className="flex justify-between gap-2">
						<Button variant="outline" onClick={onClose} className="w-full">
							Cancel
						</Button>
						<Button onClick={capturePhoto} className="w-full">
							Take Photo
						</Button>
					</div>
				</div>
			)}
		</Card>
	);
}
