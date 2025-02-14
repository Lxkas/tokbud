"use client";
import { elysia } from "@/elysia/client";
import { setCookie } from 'cookies-next';
import { useSession } from "@clerk/nextjs";
import React, { useState, useEffect } from 'react';
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

// Define interfaces for API responses and data types
interface WorkingHoursSummaryResponse {
  success: boolean;
  data: {
    data: WorkingHoursSummary[];
  };
}

interface UsersResponse {
  success: boolean;
  data: {
    data: APIUser[];
  };
}

// Data Types
interface ErrorResponse {
  success: boolean;
  error: string;
}

type ApiResponse = {
  200: ErrorResponse | {
    success: boolean;
    data: WorkingHoursSummaryResponse;
  };
};

interface WorkingHoursSummary {
  user_id: string;
  org_id: string;
  total_working_hours: string;
  total_working_days: number;
}

interface APIUser {
  user_id: string;
  employee_id: string | null;
  img: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  branch_id: string | null;
  branch_name: string | null;
  position: string | null;
  is_working: boolean | null;
}

interface User {
  id: string;
  name: string;
  avatarUrl: string;
  branch: string;
  workingSummary: string;
  status: 'working' | 'offline';
  details: {
    email: string;
    position: string;
  };
}

interface WorkingHoursShift {
  doc_id: string;
  start: string;
  end: string;
  start_official: string;
  end_official: string;
  duration: string;
  duration_official: string;
  reason: string;
  change_history: string[];
}

interface ExportedShift {
  doc_id: string;
  start: string;
  end: string;
  start_official: string;
  end_official: string;
  duration: string;
  duration_official: string;
  reason: string;
  change_history: string[];
}

interface ExportedDayShift {
  date: string;
  shifts: ExportedShift[];
}

interface ExportedUserWorkingHour {
  user_id: string;
  org_id: string;
  all_shift: ExportedDayShift[];
}

interface WorkingHoursExportData extends ExportedUserWorkingHour {
  user_info?: User;
}

interface ExportedWorkingHourSuccessResponse {
  status: "ok";
  data: ExportedUserWorkingHour[];
}

interface ExportedWorkingHourErrorResponse {
  status: "error";
  message: string;
}

type ExportedWorkingHourResponse = ExportedWorkingHourSuccessResponse | ExportedWorkingHourErrorResponse;

const AdminDashboard = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      from: firstDay,
      to: today
    };
  });
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const { isSignedIn, session } = useSession();

  // Function to format working hours
  const formatWorkingHours = (hoursStr: string): string => {
    const [hours, minutes] = hoursStr.split(':').map(Number);
    const totalHours = minutes >= 30 ? Math.ceil(hours) : Math.floor(hours);
    return `${totalHours}hrs`;
  };

  // Function to fetch working hours summary
  const fetchWorkingHoursSummary = async (
    userIds: string[], 
    startDate: Date, 
    endDate: Date
  ): Promise<WorkingHoursSummary[]> => {
    try {
      const response = await elysia.api["users"]["working-hours-summary"].post({
        user_ids: userIds,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        sort_dates_ascending: true
      });
  
      // Check for the nested data structure
      if (
        response.data?.success && 
        response.data?.data?.status === 'success' && 
        Array.isArray(response.data.data.data)
      ) {
        return response.data.data.data;
      }
  
      console.error('Response structure:', response);
      console.error('No working hours data received or invalid response format');
      
      return [];
    } catch (error) {
      console.error('Error fetching working hours:', error);
      return [];
    }
  };

  const mapApiDataToUsers = (apiUsers: APIUser[], workingHours: WorkingHoursSummary[]): User[] => {
    return apiUsers.map(apiUser => {
      const userWorkingHours = workingHours.find(wh => wh.user_id === apiUser.user_id);
      const workingSummary = userWorkingHours 
        ? `${formatWorkingHours(userWorkingHours.total_working_hours)}/${userWorkingHours.total_working_days}days`
        : '0hrs/0days';

      // Provide default values for null fields
      const firstName = apiUser.first_name || '';
      const lastName = apiUser.last_name || '';
      const email = apiUser.email || '';
      const position = apiUser.position || '';
      const branchName = apiUser.branch_name || '';
      const img = apiUser.img || '';

      return {
        id: apiUser.user_id,
        name: [firstName, lastName].filter(Boolean).join(' ') || 'null',
        avatarUrl: img,
        branch: branchName,
        workingSummary,
        status: apiUser.is_working === true ? 'working' : 'offline',
        details: {
          email,
          position
        }
      };
    });
  };

  // Updated function to use Elysia client
  const fetchUsersData = async () => {
    try {
      const response = await elysia.api["users"]["all"].get();
      if (!response.data?.data) {
        console.error('No user data received');
        return;
      }
      
      const apiUsers = response.data.data;
      
      if (dateRange?.from && dateRange?.to) {
        const workingHours = await fetchWorkingHoursSummary(
          apiUsers.map(user => user.user_id),
          dateRange.from,
          dateRange.to
        );
        const mappedUsers = mapApiDataToUsers(apiUsers, workingHours);
        
        setUsers(mappedUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchUserWorkingHoursExport = async (
    userId: string,
    startDate: string,
    endDate: string,
    session: any
  ): Promise<ExportedUserWorkingHour | null> => {
    const jwt = await session?.getToken({ template: "Auth" });
    if (!jwt) return null;
  
    setCookie("auth", jwt);
  
    try {
      const response = await elysia.api["working-hours"]["export"].get({
        query: {
          user_id: userId,
          start_date: startDate,
          end_date: endDate,
          sort_dates_ascending: true,
          sort_shifts_ascending: true
        }
      });
  
      if (!response.data) {
        console.error("No response data received");
        return null;
      }
  
      // Type guard to check if response has data array
      const hasDataArray = (resp: any): resp is { status: string; data: ExportedUserWorkingHour[] } => {
        return Array.isArray(resp.data);
      };
  
      if (hasDataArray(response.data) && response.data.data.length > 0) {
        return response.data.data[0];
      }
  
      console.error("Invalid response format or empty data");
      return null;
    } catch (error) {
      console.error(`Error fetching export data for user ${userId}:`, error);
      return null;
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchUsersData();
  }, []);

  // Fetch new working hours when date range changes
  useEffect(() => {
    if (dateRange?.from && dateRange?.to && users.length > 0) {
      fetchWorkingHoursSummary(
        users.map(user => user.id),
        dateRange.from,
        dateRange.to
      ).then(workingHours => {
        const updatedUsers = mapApiDataToUsers(
          users.map(user => ({
            user_id: user.id,
            employee_id: null,
            img: user.avatarUrl,
            first_name: user.name === 'null' ? null : user.name.split(' ')[0],
            last_name: user.name === 'null' ? null : user.name.split(' ')[1] || null,
            email: user.details.email,
            branch_id: '',
            branch_name: user.branch,
            position: user.details.position,
            is_working: user.status === 'working'
          })),
          workingHours
        );
        setUsers(updatedUsers);
      });
    }
  }, [dateRange]);

  const toggleRowExpansion = (userId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    setExpandedRows(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.branch.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExport = async () => {
    const startDate = dateRange?.from?.toISOString().split('T')[0];
    const endDate = dateRange?.to?.toISOString().split('T')[0];
    
    if (!startDate || !endDate) {
      console.error("Date range is not properly set");
      return;
    }
  
    try {
      // Get the currently filtered/displayed users
      const selectedUserData = users.filter(user => selectedUsers.includes(user.id));
  
      // Fetch data for all selected users
      const exportPromises = selectedUsers.map(async userId => {
        const exportData = await fetchUserWorkingHoursExport(userId, startDate, endDate, session);
        if (!exportData) return null;
  
        // Find the corresponding user data
        const userData = selectedUserData.find(user => user.id === userId);
        if (!userData) return null;

        // Validate user IDs match
        if (userData.id !== exportData.user_id) {
          console.error(`User ID mismatch for user ${userData.id}`);
          return null;
        }

        // Restructure the data with user info at the same level as all_shift
        return {
          user_id: userData.id,
          org_id: exportData.org_id,
          name: userData.name,
          avatarUrl: userData.avatarUrl,
          branch: userData.branch,
          workingSummary: userData.workingSummary,
          status: userData.status,
          email: userData.details.email,
          position: userData.details.position,
          all_shift: exportData.all_shift
        };
      });
  
      const results = await Promise.all(exportPromises);
      
      // Filter out null results
      const combinedData = results.filter((result): result is any => result !== null);
      
      console.log("Combined export data:", combinedData);
      
      // Download as JSON file
      const blob = new Blob([JSON.stringify(combinedData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `working-hours-export-${startDate}-to-${endDate}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error("Error exporting data:", error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <Button 
          variant="outline" 
          className="flex items-center gap-2"
          disabled={selectedUsers.length === 0}
          onClick={handleExport}
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
                    checked={selectedUsers.length === users.length}
                    onCheckedChange={() => {
                      if (selectedUsers.length === users.length) {
                        setSelectedUsers([]);
                      } else {
                        setSelectedUsers(users.map(u => u.id));
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
                    <TableCell>{user.branch}</TableCell>
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