import { useAuth } from '@/hooks/useAuth';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  Settings, 
  BookOpen,
  FileText,
  MessageSquare,
  Upload,
  GraduationCap,
  Eye,
  Calendar,
  Bell,
  ClipboardList,
  Download,
  PieChart,
  Building2
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu as SidebarMenuPrimitive,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const adminMenuItems = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Manage Users", url: "/admin/manage-users", icon: Users },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
  { title: "Structure", url: "/admin/manage-structure", icon: Building2 },
  { title: "Announcements", url: "/admin/announcements", icon: MessageSquare },
  { title: "Courses", url: "/admin/courses", icon: BookOpen },
  { title: "Course Lists", url: "/admin/course-lists", icon: FileText },
  { title: "Profile", url: "/admin/profile", icon: Settings }
];

const teacherMenuItems = [
  { title: "Profile", url: "/teacher/profile", icon: LayoutDashboard },
  { title: "Upload Materials", url: "/teacher/upload-materials", icon: Upload },
  { title: "Assignments", url: "/teacher/assignments", icon: ClipboardList },
  { title: "Class Schedule", url: "/teacher/class-schedule", icon: Calendar },
  { title: "Grade Assignments", url: "/teacher/grade-assignments", icon: ClipboardList },
  { title: "View Students", url: "/teacher/view-students", icon: Users },
  { title: "Announcements", url: "/teacher/announcements", icon: MessageSquare },
  { title: "Courses", url: "/teacher/courses", icon: BookOpen }
];

const studentMenuItems = [
  { title: "Profile", url: "/student/profile", icon: LayoutDashboard },
  { title: "View Materials", url: "/student/view-materials", icon: FileText },
  { title: "Submit Assignment", url: "/student/submit-assignment", icon: Upload },
  { title: "Timetable", url: "/student/timetable", icon: Calendar },
  { title: "Courses", url: "/student/courses", icon: BookOpen },
  { title: "View Results", url: "/student/view-results", icon: GraduationCap },
  { title: "Notifications", url: "/student/notifications", icon: Bell }
];

export function SidebarMenu() {
  const { profile } = useAuth();
  const location = useLocation();

  const getMenuItems = () => {
    switch (profile?.role) {
      case 'admin':
        return adminMenuItems;
      case 'teacher':
        return teacherMenuItems;
      case 'student':
        return studentMenuItems;
      default:
        return [];
    }
  };

  const menuItems = getMenuItems();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {profile?.role?.charAt(0).toUpperCase() + profile?.role?.slice(1)} Menu
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenuPrimitive>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                   <SidebarMenuButton asChild>
                      <NavLink 
                         to={item.url} 
                          className={({ isActive }) =>
                           `flex items-center gap-2 w-full transition-all duration-200 rounded-md px-3 py-2 border ${
                             isActive 
                               ? "bg-sidebar-primary text-sidebar-primary-foreground border-sidebar-primary font-medium shadow-sm" 
                               : "bg-sidebar-background text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium"
                           }`
                          }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenuPrimitive>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}