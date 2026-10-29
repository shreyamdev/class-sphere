import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// Public & Auth Pages
import LandingPage from "./LandingPage";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import VerifyOtp from "./pages/auth/VerifyOtp";

// Student Portal
import StudentLayout from "./layouts/StudentLayout";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudyMaterial from "./pages/student/StudyMaterial";
import Assignments from "./pages/student/Assignments";
import Quizzes from "./pages/student/Quizzes";
import AttemptQuiz from "./pages/student/AttemptQuiz";
import NotesAI from "./pages/student/NotesAI";
import Flashcards from "./pages/student/Flashcards";
import Grades from "./pages/student/Grades";
import Progress from "./pages/student/Progress";
import StudentAnnouncements from "./pages/student/Announcements";
import StudentDoubtForum from "./pages/student/DoubtForum";
import MyClasses from "./pages/student/MyClasses";
import ClassDetails from "./pages/student/ClassDetails";
import StudentHelpCenter from "./pages/student/HelpCenter";

// Teacher Portal
import TeacherLayout from "./layouts/TeacherLayout";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import CreateClassroom from "./pages/teacher/CreateClassroom";
import ManageMembers from "./pages/teacher/ManageMembers";
import UploadMaterial from "./pages/teacher/UploadMaterial";
import CreateAssignment from "./pages/teacher/CreateAssignment";
import StudentSubmissions from "./pages/teacher/StudentSubmissions";
import CreateQuiz from "./pages/teacher/CreateQuiz";
import QuizResults from "./pages/teacher/QuizResults";
import ClassAnalytics from "./pages/teacher/ClassAnalytics";
import TeacherAnnouncements from "./pages/teacher/Announcements";
import TeacherDoubtForum from "./pages/teacher/DoubtForum";
import HelpCenter from "./pages/teacher/Helpcenter";
import useScrollReveal from "./hooks/useScrollReveal";

function ScrollRevealManager() {
  useScrollReveal();
  return null;
}

function RequireAuth() {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted">
        Checking your session...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollRevealManager />
      <Routes>
       
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />

     
        <Route element={<RequireAuth />}>
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="materials" element={<StudyMaterial />} />
            <Route path="assignments" element={<Assignments />} />
            <Route path="quizzes" element={<Quizzes />} />
            <Route path="quizzes/:quizId" element={<AttemptQuiz />} />
            <Route path="notes-ai" element={<NotesAI />} />
            <Route path="flashcards" element={<Flashcards />} />
            <Route path="grades" element={<Grades />} />
            <Route path="progress" element={<Progress />} />
            <Route path="announcements" element={<StudentAnnouncements />} />
            <Route path="doubts" element={<StudentDoubtForum />} />
            <Route path="classes" element={<MyClasses />} />
            <Route path="classes/:classId" element={<ClassDetails />} />
            <Route path="help" element={<StudentHelpCenter />} />
            <Route path="help-center" element={<StudentHelpCenter />} />
          </Route>

          <Route path="/teacher" element={<TeacherLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<TeacherDashboard />} />
            <Route path="create-class" element={<CreateClassroom />} />
            <Route path="create-classroom" element={<CreateClassroom />} />
            <Route path="members" element={<ManageMembers />} />
            <Route path="upload-material" element={<UploadMaterial />} />
            <Route path="create-assignment" element={<CreateAssignment />} />
            <Route path="submissions" element={<StudentSubmissions />} />
            <Route path="create-quiz" element={<CreateQuiz />} />
            <Route path="quiz-results" element={<QuizResults />} />
            <Route path="analytics" element={<ClassAnalytics />} />
            <Route path="announcements" element={<TeacherAnnouncements />} />
            <Route path="doubts" element={<TeacherDoubtForum />} />
            <Route path="doubt-forum" element={<TeacherDoubtForum />} />
            <Route path="doubtforum" element={<TeacherDoubtForum />} />
            <Route path="help" element={<HelpCenter />} />
            <Route path="help-center" element={<HelpCenter />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}