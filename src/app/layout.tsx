import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@radix-ui/react-separator";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Tokbud",
	description: "TBD",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<ClerkProvider>
			<html lang="en">
				<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
					<SidebarProvider>
						<AppSidebar />
						<SidebarInset>
							<header className="flex sticky top-0 bg-background h-16 shrink-0 items-center gap-2 border-b px-4">
								<SidebarTrigger className="-ml-1" />
								<Separator orientation="vertical" className="mr-2 h-4" />
								PATH HERE
								<SignedIn>
									<UserButton />
								</SignedIn>
								<SignedOut>
									<SignInButton />
								</SignedOut>
							</header>
							<div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
						</SidebarInset>
					</SidebarProvider>
				</body>
			</html>
		</ClerkProvider>
	);
}
