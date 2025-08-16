import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/providers/theme-provider";

// Auth pages
import Login from "./pages/Auth/Login";
import Apply from "./pages/Auth/Apply";
import RecoverPassword from "./pages/Auth/RecoverPassword";
import ResetPassword from "./pages/Auth/ResetPassword";
import Success from "./pages/Auth/Success";

// Admin pages
import AdminDashboard from "./pages/Admin/Dashboard";
import ManageUsers from "./pages/Admin/ManageUsers";
import Analytics from "./pages/Admin/Analytics";
import ManageStructure from "./pages/Admin/ManageStructure";
import AdminAnnouncements from "./pages/Admin/Announcements";
import AdminCourses from "./pages/Admin/Courses";
import CourseLists from "./pages/Admin/CourseLists";
import AdminProfile from "./pages/Admin/Profile";
import UserManagement from "./pages/Admin/UserManagement";

// Teacher pages
import TeacherProfile from "./pages/Teacher/Profile";
import TeacherAnnouncements from "./pages/Teacher/Announcements";
import TeacherCourses from "./pages/Teacher/Courses";
import UploadMaterials from "./pages/Teacher/UploadMaterials";
import TeacherAssignments from "./pages/Teacher/Assignments";
import TeacherClassSchedule from "./pages/Teacher/ClassSchedule";
import GradeAssignments from "./pages/Teacher/GradeAssignments";
import ViewStudents from "./pages/Teacher/ViewStudents";

// Student pages
import StudentProfile from "./pages/Student/Profile";
import StudentViewMaterials from "./pages/Student/ViewMaterials";
import StudentSubmitAssignment from "./pages/Student/SubmitAssignment";
import StudentTimetable from "./pages/Student/Timetable";
import StudentCourses from "./pages/Student/Courses";
import StudentViewResults from "./pages/Student/ViewResults";
import StudentNotifications from "./pages/Student/Notifications";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              
              {/* Auth Routes */}
              <Route path="/auth/login" element={<Login />} />
              <Route path="/auth/apply" element={<Apply />} />
              <Route path="/auth/forgot-password" element={<RecoverPassword />} />
              <Route path="/auth/recover-password" element={<Navigate to="/auth/forgot-password" replace />} />
              <Route path="/auth/reset-password" element={<ResetPassword />} />
              <Route path="/auth/success" element={<Success />} />
              
              {/* Admin Routes */}
              <Route path="/admin/dashboard" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/manage-users" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ManageUsers />
                </ProtectedRoute>
              } />
              <Route path="/admin/analytics" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Analytics />
                </ProtectedRoute>
              } />
              <Route path="/admin/manage-structure" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ManageStructure />
                </ProtectedRoute>
              } />
              <Route path="/admin/announcements" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminAnnouncements />
                </ProtectedRoute>
              } />
              <Route path="/admin/courses" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminCourses />
                </ProtectedRoute>
              } />
              <Route path="/admin/course-lists" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <CourseLists />
                </ProtectedRoute>
              } />
              <Route path="/admin/profile" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminProfile />
                </ProtectedRoute>
              } />
              <Route path="/admin/users" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <UserManagement />
                </ProtectedRoute>
              } />
              
              {/* Teacher Routes */}
              <Route path="/teacher/profile" element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <TeacherProfile />
                </ProtectedRoute>
              } />
              <Route path="/teacher/announcements" element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <TeacherAnnouncements />
                </ProtectedRoute>
              } />
              <Route path="/teacher/courses" element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <TeacherCourses />
                </ProtectedRoute>
              } />
              <Route path="/teacher/upload-materials" element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <UploadMaterials />
                </ProtectedRoute>
              } />
              <Route path="/teacher/assignments" element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <TeacherAssignments />
                </ProtectedRoute>
              } />
              <Route path="/teacher/class-schedule" element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <TeacherClassSchedule />
                </ProtectedRoute>
              } />
              <Route path="/teacher/grade-assignments" element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <GradeAssignments />
                </ProtectedRoute>
              } />
              <Route path="/teacher/view-students" element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <ViewStudents />
                </ProtectedRoute>
              } />
              
              {/* Student Routes */}
              <Route path="/student/profile" element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentProfile />
                </ProtectedRoute>
              } />
              <Route path="/student/view-materials" element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentViewMaterials />
                </ProtectedRoute>
              } />
              <Route path="/student/submit-assignment" element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentSubmitAssignment />
                </ProtectedRoute>
              } />
              <Route path="/student/timetable" element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentTimetable />
                </ProtectedRoute>
              } />
              <Route path="/student/courses" element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentCourses />
                </ProtectedRoute>
              } />
              <Route path="/student/view-results" element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentViewResults />
                </ProtectedRoute>
              } />
              <Route path="/student/notifications" element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentNotifications />
                </ProtectedRoute>
              } />
              
              {/* Redirect based on role */}
              <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
