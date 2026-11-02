import { useEffect, lazy, Suspense, type ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { useThemeSync } from "@/hooks/useThemeSync";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { SessionTimeoutWarning } from "@/components/SessionTimeoutWarning";
import { HighPriorityNotification } from "@/components/HighPriorityNotification";

// Auth pages
import Login from "./pages/Auth/Login";
// Load a page on demand, and remember how to load it so every page can be
// fetched quietly in the background once the first screen has shown.
const pageLoaders: Array<() => Promise<unknown>> = [];
function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  pageLoaders.push(load);
  return lazy(load);
}

const Apply = lazyPage(() => import("./pages/Auth/Apply"));
const RecoverPassword = lazyPage(() => import("./pages/Auth/RecoverPassword"));
const ResetPassword = lazyPage(() => import("./pages/Auth/ResetPassword"));
const Success = lazyPage(() => import("./pages/Auth/Success"));
const ChangeEmail = lazyPage(() => import("./pages/Auth/ChangeEmail"));

// Admin pages
const AdminDashboard = lazyPage(() => import("./pages/Admin/Dashboard"));
const ManageUsers = lazyPage(() => import("./pages/Admin/ManageUsers"));
const Analytics = lazyPage(() => import("./pages/Admin/Analytics"));
const ManageStructure = lazyPage(() => import("./pages/Admin/ManageStructure"));
const AdminAnnouncements = lazyPage(() => import("./pages/Admin/Announcements"));
const AdminCourses = lazyPage(() => import("./pages/Admin/Courses"));
const CourseLists = lazyPage(() => import("./pages/Admin/CourseLists"));
const AdminProfile = lazyPage(() => import("./pages/Admin/Profile"));
const AdminNotifications = lazyPage(() => import("./pages/Admin/Notifications"));
const SemesterSettings = lazyPage(() => import("./pages/Admin/SemesterSettings"));
const AdminStudentDetail = lazyPage(() => import("./pages/Admin/StudentDetail"));
const AdminPayments = lazyPage(() => import("./pages/Admin/Payments"));
const AdminVoting = lazyPage(() => import("./pages/Admin/Voting"));
const AdminFeedback = lazyPage(() => import("./pages/Admin/Feedback"));
const AdminExamTimetable = lazyPage(() => import("./pages/Admin/ExamTimetable"));
const AdminSupport = lazyPage(() => import("./pages/Admin/Support"));
const AuditLogs = lazyPage(() => import("./pages/Admin/AuditLogs"));

// Teacher pages
const TeacherProfile = lazyPage(() => import("./pages/Teacher/Profile"));
const TeacherDashboard = lazyPage(() => import("./pages/Teacher/Dashboard"));
const TeacherAnnouncements = lazyPage(() => import("./pages/Teacher/Announcements"));
const TeacherCourses = lazyPage(() => import("./pages/Teacher/Courses"));
const UploadMaterials = lazyPage(() => import("./pages/Teacher/UploadMaterials"));
const TeacherAssignments = lazyPage(() => import("./pages/Teacher/Assignments"));
const TeacherClassSchedule = lazyPage(() => import("./pages/Teacher/ClassSchedule"));
const GradeAssignments = lazyPage(() => import("./pages/Teacher/GradeAssignments"));
const TeacherAttendance = lazyPage(() => import("./pages/Teacher/Attendance"));
const TeacherQuizzes = lazyPage(() => import("./pages/Teacher/Quizzes"));
const QuizSecurity = lazyPage(() => import("./pages/Teacher/QuizSecurity"));
const ViewStudents = lazyPage(() => import("./pages/Teacher/ViewStudents"));
const TeacherNotifications = lazyPage(() => import("./pages/Teacher/Notifications"));
const TeacherStudentDetail = lazyPage(() => import("./pages/Teacher/StudentDetail"));
const TeacherFeedback = lazyPage(() => import("./pages/Teacher/Feedback"));
const TeacherExamTimetable = lazyPage(() => import("./pages/Teacher/ExamTimetable"));

// Student pages
const StudentProfile = lazyPage(() => import("./pages/Student/Profile"));
const StudentDashboard = lazyPage(() => import("./pages/Student/Dashboard"));
const StudentViewMaterials = lazyPage(() => import("./pages/Student/ViewMaterials"));
const StudentSubmitAssignment = lazyPage(() => import("./pages/Student/SubmitAssignment"));
const StudentTimetable = lazyPage(() => import("./pages/Student/Timetable"));
const StudentCourses = lazyPage(() => import("./pages/Student/Courses"));
const StudentViewResults = lazyPage(() => import("./pages/Student/ViewResults"));
const StudentNotifications = lazyPage(() => import("./pages/Student/Notifications"));
const StudentAttendance = lazyPage(() => import("./pages/Student/Attendance"));
const StudentQuizzes = lazyPage(() => import("./pages/Student/Quizzes"));
const StudentID = lazyPage(() => import("./pages/Student/StudentID"));
const StudentAnalytics = lazyPage(() => import("./pages/Student/Analytics"));
const StudentPayments = lazyPage(() => import("./pages/Student/Payments"));
const StudentVoting = lazyPage(() => import("./pages/Student/Voting"));
const StudentFeedback = lazyPage(() => import("./pages/Student/Feedback"));
const StudentExamTimetable = lazyPage(() => import("./pages/Student/ExamTimetable"));
const StudentSupport = lazyPage(() => import("./pages/Student/Support"));

const Verify = lazyPage(() => import("./pages/Verify"));
const PublicStudentVerify = lazyPage(() => import("./pages/PublicStudentVerify"));
const VerifyPayment = lazyPage(() => import("./pages/VerifyPayment"));


import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const TeacherAnalytics = lazyPage(() => import("./pages/Teacher/Analytics"));

const queryClient = new QueryClient();

function AppRoutes() {
  useThemeSync();

  // After the first screen is up, download the remaining pages in the
  // background so moving between pages stays instant.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      pageLoaders.forEach((load) => load().catch(() => {}));
    }, 2000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    // Pages load on demand, so visitors only download the page they open
    // (everything used to ship in one 578 KB file).
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
    <Routes>
      <Route path="/" element={<Index />} />
      
      {/* Auth Routes */}
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/apply" element={<Apply />} />
      <Route path="/auth/forgot-password" element={<RecoverPassword />} />
      <Route path="/auth/recover-password" element={<Navigate to="/auth/forgot-password" replace />} />
      <Route path="/auth/reset-password" element={<ResetPassword />} />
      <Route path="/auth/success" element={<Success />} />
      <Route path="/dashboard/change-email" element={<ProtectedRoute allowedRoles={['admin','teacher','student']}><ChangeEmail /></ProtectedRoute>} />
      
      {/* Verification Routes (public) */}
      <Route path="/verify" element={<Verify />} />
      <Route path="/verify/student/:code" element={<PublicStudentVerify />} />

      <Route path="/verify/payment/:id" element={<VerifyPayment />} />
      
      {/* Admin Routes */}
      <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/manage-users" element={<ProtectedRoute allowedRoles={['admin']}><ManageUsers /></ProtectedRoute>} />
      <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin']}><Analytics /></ProtectedRoute>} />
      <Route path="/admin/manage-structure" element={<ProtectedRoute allowedRoles={['admin']}><ManageStructure /></ProtectedRoute>} />
      <Route path="/admin/announcements" element={<ProtectedRoute allowedRoles={['admin']}><AdminAnnouncements /></ProtectedRoute>} />
      <Route path="/admin/courses" element={<ProtectedRoute allowedRoles={['admin']}><AdminCourses /></ProtectedRoute>} />
      <Route path="/admin/course-lists" element={<ProtectedRoute allowedRoles={['admin']}><CourseLists /></ProtectedRoute>} />
      <Route path="/admin/profile" element={<ProtectedRoute allowedRoles={['admin']}><AdminProfile /></ProtectedRoute>} />
      <Route path="/admin/notifications" element={<ProtectedRoute allowedRoles={['admin']}><AdminNotifications /></ProtectedRoute>} />
      {/* User Management was merged into Manage Users; keep old links working */}
      <Route path="/admin/users" element={<Navigate to="/admin/manage-users" replace />} />
      <Route path="/admin/semester-settings" element={<ProtectedRoute allowedRoles={['admin']}><SemesterSettings /></ProtectedRoute>} />
      <Route path="/admin/student-detail" element={<ProtectedRoute allowedRoles={['admin']}><AdminStudentDetail /></ProtectedRoute>} />
      <Route path="/admin/students/:id" element={<ProtectedRoute allowedRoles={['admin']}><AdminStudentDetail /></ProtectedRoute>} />
      <Route path="/admin/payments" element={<ProtectedRoute allowedRoles={['admin']}><AdminPayments /></ProtectedRoute>} />
      <Route path="/admin/voting" element={<ProtectedRoute allowedRoles={['admin']}><AdminVoting /></ProtectedRoute>} />
      <Route path="/admin/feedback" element={<ProtectedRoute allowedRoles={['admin']}><AdminFeedback /></ProtectedRoute>} />
      <Route path="/admin/support" element={<ProtectedRoute allowedRoles={['admin']}><AdminSupport /></ProtectedRoute>} />
      <Route path="/admin/audit-logs" element={<ProtectedRoute allowedRoles={['admin']}><AuditLogs /></ProtectedRoute>} />
      <Route path="/admin/exam-timetable" element={<ProtectedRoute allowedRoles={['admin']}><AdminExamTimetable /></ProtectedRoute>} />
      
      {/* Teacher Routes */}
      <Route path="/teacher/dashboard" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherDashboard /></ProtectedRoute>} />
      <Route path="/teacher/profile" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherProfile /></ProtectedRoute>} />
      <Route path="/teacher/announcements" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherAnnouncements /></ProtectedRoute>} />
      <Route path="/teacher/courses" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherCourses /></ProtectedRoute>} />
      <Route path="/teacher/upload-materials" element={<ProtectedRoute allowedRoles={['teacher']}><UploadMaterials /></ProtectedRoute>} />
      <Route path="/teacher/assignments" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherAssignments /></ProtectedRoute>} />
      <Route path="/teacher/class-schedule" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherClassSchedule /></ProtectedRoute>} />
      <Route path="/teacher/grade-assignments" element={<ProtectedRoute allowedRoles={['teacher']}><GradeAssignments /></ProtectedRoute>} />
      <Route path="/teacher/view-students" element={<ProtectedRoute allowedRoles={['teacher']}><ViewStudents /></ProtectedRoute>} />
      <Route path="/teacher/attendance" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherAttendance /></ProtectedRoute>} />
      <Route path="/teacher/quizzes" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherQuizzes /></ProtectedRoute>} />
      <Route path="/teacher/quiz-security" element={<ProtectedRoute allowedRoles={['teacher']}><QuizSecurity /></ProtectedRoute>} />
      <Route path="/teacher/notifications" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherNotifications /></ProtectedRoute>} />
      <Route path="/teacher/analytics" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherAnalytics /></ProtectedRoute>} />
      <Route path="/teacher/student-detail" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherStudentDetail /></ProtectedRoute>} />
      <Route path="/teacher/feedback" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherFeedback /></ProtectedRoute>} />
      <Route path="/teacher/exam-timetable" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherExamTimetable /></ProtectedRoute>} />
      
      {/* Student Routes */}
      <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/profile" element={<ProtectedRoute allowedRoles={['student']}><StudentProfile /></ProtectedRoute>} />
      <Route path="/student/view-materials" element={<ProtectedRoute allowedRoles={['student']}><StudentViewMaterials /></ProtectedRoute>} />
      <Route path="/student/submit-assignment" element={<ProtectedRoute allowedRoles={['student']}><StudentSubmitAssignment /></ProtectedRoute>} />
      <Route path="/student/timetable" element={<ProtectedRoute allowedRoles={['student']}><StudentTimetable /></ProtectedRoute>} />
      <Route path="/student/courses" element={<ProtectedRoute allowedRoles={['student']}><StudentCourses /></ProtectedRoute>} />
      <Route path="/student/view-results" element={<ProtectedRoute allowedRoles={['student']}><StudentViewResults /></ProtectedRoute>} />
      <Route path="/student/notifications" element={<ProtectedRoute allowedRoles={['student']}><StudentNotifications /></ProtectedRoute>} />
      <Route path="/student/attendance" element={<ProtectedRoute allowedRoles={['student']}><StudentAttendance /></ProtectedRoute>} />
      <Route path="/student/quizzes" element={<ProtectedRoute allowedRoles={['student']}><StudentQuizzes /></ProtectedRoute>} />
      <Route path="/student/student-id" element={<ProtectedRoute allowedRoles={['student']}><StudentID /></ProtectedRoute>} />
      <Route path="/student/analytics" element={<ProtectedRoute allowedRoles={['student']}><StudentAnalytics /></ProtectedRoute>} />
      <Route path="/student/payments" element={<ProtectedRoute allowedRoles={['student']}><StudentPayments /></ProtectedRoute>} />
      <Route path="/student/voting" element={<ProtectedRoute allowedRoles={['student']}><StudentVoting /></ProtectedRoute>} />
      <Route path="/student/feedback" element={<ProtectedRoute allowedRoles={['student']}><StudentFeedback /></ProtectedRoute>} />
      <Route path="/student/support" element={<ProtectedRoute allowedRoles={['student']}><StudentSupport /></ProtectedRoute>} />
      <Route path="/student/exam-timetable" element={<ProtectedRoute allowedRoles={['student']}><StudentExamTimetable /></ProtectedRoute>} />
      
      <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
}

const App = () => {
  useEffect(() => {
    console.log("%cBuilt by Shalen", "color: #ff69b4; font-size:14px; font-weight:bold;");
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
            <PushNotificationPrompt />
            <UpdatePrompt />
            <SessionTimeoutWarning />
            <HighPriorityNotification />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;
