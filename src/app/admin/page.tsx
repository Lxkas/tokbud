"use client";
import React, { useState } from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRange } from "react-day-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  Search, 
  ChevronDown, 
  Circle 
} from "lucide-react";

// Define interfaces for type safety
interface UserDetails {
  email: string;
  department: string;
  position: string;
  totalHours: number;
  projects: string[];
}

interface User {
  id: number;
  name: string;
  avatarUrl: string;
  organization: string;
  workingSummary: string;
  status: 'working' | 'offline';
  details: UserDetails;
}

// Mock data with proper typing
const mockUsers: User[] = [
  {
    id: 1,
    name: "John Doe",
    avatarUrl: "https://img.clerk.com/eyJ0eXBlIjoicHJveHkiLCJzcmMiOiJodHRwczovL2ltYWdlcy5jbGVyay5kZXYvb2F1dGhfbGluZS9pbWdfMnNyRFdxQ3RRSzhRbVJpOVlkVUpZV1E4YWVhIn0",
    organization: "Tech Corp",
    workingSummary: "40hrs/5days",
    status: "working",
    details: {
      email: "john@techcorp.com",
      department: "Engineering",
      position: "Senior Developer",
      totalHours: 160,
      projects: ["Project A", "Project B"]
    }
  },
  {
    id: 2,
    name: "Jane Smith",
    avatarUrl: "https://img.clerk.com/eyJ0eXBlIjoicHJveHkiLCJzcmMiOiJodHRwczovL2ltYWdlcy5jbGVyay5kZXYvb2F1dGhfbGluZS9pbWdfMnNyRFI0V2xkTko2WjEzbnlhcDJDc2NOdjdVIn0",
    organization: "Design Studio",
    workingSummary: "32hrs/4days",
    status: "offline",
    details: {
      email: "jane@designstudio.com",
      department: "Design",
      position: "UI/UX Designer",
      totalHours: 128,
      projects: ["Website Redesign"]
    }
  }
];

const AdminDashboard = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date()
  });
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedRows, setExpandedRows] = useState<number[]>([]);

  // Toggle row expansion with proper typing
  const toggleRowExpansion = (userId: number, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    setExpandedRows(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Toggle user selection with proper typing
  const toggleUserSelection = (userId: number) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Filter users based on search query
  const filteredUsers = mockUsers.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.organization.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <Button 
          variant="outline" 
          className="flex items-center gap-2"
          disabled={selectedUsers.length === 0}
        >
          <Download className="w-4 h-4" />
          Export Selected
        </Button>
      </div>

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range: DateRange | undefined) => setDateRange(range)}
                className="rounded-md border"
              />
            </div>
            <div className="flex-1 relative">
              <Input
                placeholder="Search users or organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10"
              />
              <Search className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={selectedUsers.length === mockUsers.length}
                    onCheckedChange={() => {
                      if (selectedUsers.length === mockUsers.length) {
                        setSelectedUsers([]);
                      } else {
                        setSelectedUsers(mockUsers.map(u => u.id));
                      }
                    }}
                  />
                </TableHead>
                <TableHead>
                  <div className="w-12"></div>
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Working Summary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map(user => (
                <React.Fragment key={user.id}>
                  <TableRow 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleRowExpansion(user.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox 
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={() => toggleUserSelection(user.id)}
                      />
                    </TableCell>
                    <TableCell className="w-12 min-w-[48px]">
                      <img 
                        src={user.avatarUrl} 
                        alt={`${user.name}'s avatar`}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    </TableCell>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.organization}</TableCell>
                    <TableCell>{user.workingSummary}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={user.status === 'working' ? 'default' : 'secondary'}
                        className="flex items-center gap-1"
                      >
                        <Circle className="w-2 h-2 fill-current" /> {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => toggleRowExpansion(user.id, e)}
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${
                          expandedRows.includes(user.id) ? 'transform rotate-180' : ''
                        }`} />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedRows.includes(user.id) && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="p-4 bg-muted/50 rounded-md">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="font-medium">Email</p>
                              <p className="text-sm text-muted-foreground">{user.details.email}</p>
                            </div>
                            <div>
                              <p className="font-medium">Position</p>
                              <p className="text-sm text-muted-foreground">{user.details.position}</p>
                            </div>
                            {/* <div>
                              <p className="font-medium">Department</p>
                              <p className="text-sm text-muted-foreground">{user.details.department}</p>
                            </div>
                            <div>
                              <p className="font-medium">Total Hours</p>
                              <p className="text-sm text-muted-foreground">{user.details.totalHours}hrs</p>
                            </div>
                            <div className="col-span-2">
                              <p className="font-medium">Projects</p>
                              <div className="flex gap-2 mt-1">
                                {user.details.projects.map(project => (
                                  <Badge key={project} variant="outline">
                                    {project}
                                  </Badge>
                                ))}
                              </div>
                            </div> */}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;