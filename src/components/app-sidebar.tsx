import * as React from "react";
import { ChevronRight } from "lucide-react";

import { SearchForm } from "@/components/search-form";
import { VersionSwitcher } from "@/components/version-switcher";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import Link from "next/link";

const data = {
	branches: ["Silom", "Sathorn", "Sukhumvit"],
	navMain: [
		{
			title: "Time Tracking",
			url: "#",
			items: [
				{
					title: "Clock in/out",
					url: "/",
				},
				{
					title: "Edit Time",
					url: "/edit",
				},
			],
		},

		{
			title: "Overtime",
			url: "#",
			items: [
				{
					title: "Add/remove Overtime",
					url: "#",
				},
				{
					title: "Edit Overtime",
					url: "#",
				},
			],
		},
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar {...props}>
			<SidebarHeader>
				<VersionSwitcher versions={data.branches} defaultVersion={data.branches[0]} />
			</SidebarHeader>
			<SidebarContent className="gap-0">
				{/* We create a collapsible SidebarGroup for each parent. */}
				{data.navMain.map((item) => (
					<Collapsible key={item.title} title={item.title} defaultOpen={false} className="group/collapsible">
						<SidebarGroup>
							<SidebarGroupLabel
								asChild
								className="group/label text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
							>
								<CollapsibleTrigger>
									{item.title}{" "}
									<ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
								</CollapsibleTrigger>
							</SidebarGroupLabel>
							<CollapsibleContent>
								<SidebarGroupContent>
									<SidebarMenu>
										{item.items.map((item) => (
											<SidebarMenuItem key={item.title}>
												<SidebarMenuButton asChild>
													<Link href={item.url}>{item.title}</Link>
												</SidebarMenuButton>
											</SidebarMenuItem>
										))}
									</SidebarMenu>
								</SidebarGroupContent>
							</CollapsibleContent>
						</SidebarGroup>
					</Collapsible>
				))}
			</SidebarContent>
			<SidebarRail />
		</Sidebar>
	);
}
