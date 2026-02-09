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
  { title: "Grade Assignments", url: "/teacher/grade-assignments", icon: ClipboardList },
  { title: "Quizzes", url: "/teacher/quizzes", icon: BookOpen },
  { title: "Attendance", url: "/teacher/attendance", icon: Calendar },
  { title: "Class Schedule", url: "/teacher/class-schedule", icon: Calendar },
  { title: "View Students", url: "/teacher/view-students", icon: Users },
  { title: "Announcements", url: "/teacher/announcements", icon: MessageSquare },
  { title: "Courses", url: "/teacher/courses", icon: BookOpen }
];

const studentMenuItems = [
  { title: "Profile", url: "/student/profile", icon: LayoutDashboard },
  { title: "View Materials", url: "/student/view-materials", icon: FileText },
  { title: "Submit Assignment", url: "/student/submit-assignment", icon: Upload },
  { title: "Quizzes", url: "/student/quizzes", icon: BookOpen },
  { title: "Attendance", url: "/student/attendance", icon: Calendar },
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
                           `flex items-center gap-3 w-full transition-all duration-300 rounded-lg px-3 py-2.5 group ${
                             isActive 
                               ? "bg-primary/10 text-primary border-l-4 border-primary font-semibold shadow-sm" 
                               : "text-muted-foreground hover:text-primary hover:bg-primary/5 font-medium border-l-4 border-transparent hover:border-primary/30"
                           }`
                          }
                    >
                      <item.icon className={`h-5 w-5 transition-all duration-300 ${
                        location.pathname === item.url 
                          ? "text-primary" 
                          : "text-muted-foreground group-hover:text-primary"
                      }`} />
                      <span className="transition-all duration-300">{item.title}</span>
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