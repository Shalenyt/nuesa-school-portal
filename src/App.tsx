import { useEffect } from "react";
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
import { SessionTimeoutWarning } from "@/components/SessionTimeoutWarning";
import { HighPriorityNotification } from "@/components/HighPriorityNotification";

// Auth pages
import Login from "./pages/Auth/Login";
import Apply from "./pages/Auth/Apply";
import RecoverPassword from "./pages/Auth/RecoverPassword";
import ResetPassword from "./pages/Auth/ResetPassword";
import Success from "./pages/Auth/Success";
import ChangeEmail from "./pages/Auth/ChangeEmail";

// Admin pages
import AdminDashboard from "./pages/Admin/Dashboard";
import ManageUsers from "./pages/Admin/ManageUsers";
import Analytics from "./pages/Admin/Analytics";
import ManageStructure from "./pages/Admin/ManageStructure";
import AdminAnnouncements from "./pages/Admin/Announcements";
import AdminCourses from "./pages/Admin/Courses";
import CourseLists from "./pages/Admin/CourseLists";
import AdminProfile from "./pages/Admin/Profile";
import AdminNotifications from "./pages/Admin/Notifications";
import UserManagement from "./pages/Admin/UserManagement";
import SemesterSettings from "./pages/Admin/SemesterSettings";
import AdminStudentDetail from "./pages/Admin/StudentDetail";
import AdminPayments from "./pages/Admin/Payments";
import AdminVoting from "./pages/Admin/Voting";
import AdminFeedback from "./pages/Admin/Feedback";
import AdminExamTimetable from "./pages/Admin/ExamTimetable";

// Teacher pages
import TeacherProfile from "./pages/Teacher/Profile";
import TeacherAnnouncements from "./pages/Teacher/Announcements";
import TeacherCourses from "./pages/Teacher/Courses";
import UploadMaterials from "./pages/Teacher/UploadMaterials";
import TeacherAssignments from "./pages/Teacher/Assignments";
import TeacherClassSchedule from "./pages/Teacher/ClassSchedule";
import GradeAssignments from "./pages/Teacher/GradeAssignments";
import TeacherAttendance from "./pages/Teacher/Attendance";
import TeacherQuizzes from "./pages/Teacher/Quizzes";
import QuizSecurity from "./pages/Teacher/QuizSecurity";
import ViewStudents from "./pages/Teacher/ViewStudents";
import TeacherNotifications from "./pages/Teacher/Notifications";
import TeacherStudentDetail from "./pages/Teacher/StudentDetail";
import TeacherFeedback from "./pages/Teacher/Feedback";
import TeacherExamTimetable from "./pages/Teacher/ExamTimetable";

// Student pages
import StudentProfile from "./pages/Student/Profile";
import StudentDashboard from "./pages/Student/Dashboard";
import StudentViewMaterials from "./pages/Student/ViewMaterials";
import StudentSubmitAssignment from "./pages/Student/SubmitAssignment";
import StudentTimetable from "./pages/Student/Timetable";
import StudentCourses from "./pages/Student/Courses";
import StudentViewResults from "./pages/Student/ViewResults";
import StudentNotifications from "./pages/Student/Notifications";
import StudentAttendance from "./pages/Student/Attendance";
import StudentQuizzes from "./pages/Student/Quizzes";
import StudentID from "./pages/Student/StudentID";
import StudentAnalytics from "./pages/Student/Analytics";
import StudentPayments from "./pages/Student/Payments";
import StudentVoting from "./pages/Student/Voting";
import StudentFeedback from "./pages/Student/Feedback";
import StudentExamTimetable from "./pages/Student/ExamTimetable";

import Verify from "./pages/Verify";
import VerifyPayment from "./pages/VerifyPayment";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

import TeacherAnalytics from "./pages/Teacher/Analytics";

const queryClient = new QueryClient();

function AppRoutes() {
  useThemeSync();

  return (
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
      <Route path="/verify/student/:id" element={<Verify />} />
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
      <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
      <Route path="/admin/semester-settings" element={<ProtectedRoute allowedRoles={['admin']}><SemesterSettings /></ProtectedRoute>} />
      <Route path="/admin/student-detail" element={<ProtectedRoute allowedRoles={['admin']}><AdminStudentDetail /></ProtectedRoute>} />
      <Route path="/admin/students/:id" element={<ProtectedRoute allowedRoles={['admin']}><AdminStudentDetail /></ProtectedRoute>} />
      <Route path="/admin/payments" element={<ProtectedRoute allowedRoles={['admin']}><AdminPayments /></ProtectedRoute>} />
      <Route path="/admin/voting" element={<ProtectedRoute allowedRoles={['admin']}><AdminVoting /></ProtectedRoute>} />
      <Route path="/admin/feedback" element={<ProtectedRoute allowedRoles={['admin']}><AdminFeedback /></ProtectedRoute>} />
      <Route path="/admin/exam-timetable" element={<ProtectedRoute allowedRoles={['admin']}><AdminExamTimetable /></ProtectedRoute>} />
      
      {/* Teacher Routes */}
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
      <Route path="/student/exam-timetable" element={<ProtectedRoute allowedRoles={['student']}><StudentExamTimetable /></ProtectedRoute>} />
      
      <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
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
