import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Users, FileCheck2, Award, PlusCircle,
  ArrowRight, Copy, Check, FolderPlus, HelpCircle, Upload
} from 'lucide-react';
import Topbar from '../../components/Topbar';
import HeroBanner from '../../components/HeroBanner';
import StatCard from '../../components/StatCard';
import { fetchMyClassrooms } from '../../services/classroomService';
import { useAuth } from '../../context/authContext';
import { getTeacherClassroomAnalytics } from '../../services/analyticsService';
import {
  getAssignmentSubmissions,
  getClassroomAssignments,
} from '../../services/assignmentService';

function apiErrorMessage(error) {
  const status = error?.status ? `HTTP ${error.status}: ` : '';
  return `${status}${error?.message || 'request failed'}`;
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dataError, setDataError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [copiedCode, setCopiedCode] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    totalStudents: 0,
    pendingGrading: [],
    pendingGradingCount: 0,
    averagePercentage: null,
    classAverages: [],
  });

  useEffect(() => {
    let ignore = false;
    async function loadDashboard() {
      setLoading(true);
      setLoadError('');
      setDataError('');

      let items;
      try {
        items = await fetchMyClassrooms();
      } catch (err) {
        if (!ignore) {
          setLoadError(apiErrorMessage(err));
          setLoading(false);
        }
        return;
      }
      if (ignore) return;
      setClassrooms(items);
      setLoading(false);

      try {
        const errors = [];
        const results = await Promise.all(items.map(async (classroom) => {
          const classroomId = classroom._id ?? classroom.id;
          if (!classroomId) {
            errors.push(`Could not load data for "${classroom.name ?? 'a classroom'}": missing classroom ID.`);
            return { classroom, analytics: null, pendingGrading: [] };
          }

          const [analyticsResult, assignmentsResult] = await Promise.allSettled([
            getTeacherClassroomAnalytics(classroomId),
            getClassroomAssignments(classroomId),
          ]);
          const analytics = analyticsResult.status === 'fulfilled'
            ? analyticsResult.value
            : null;
          const assignments = assignmentsResult.status === 'fulfilled'
            ? assignmentsResult.value
            : [];
          const classroomName = classroom.name ?? classroom.title ?? 'Classroom';

          if (analyticsResult.status === 'rejected') {
            errors.push(`${classroomName}: analytics request failed (${apiErrorMessage(analyticsResult.reason)}).`);
          }
          if (assignmentsResult.status === 'rejected') {
            errors.push(`${classroomName}: assignments request failed (${apiErrorMessage(assignmentsResult.reason)}).`);
          }

          const submissionResults = await Promise.all(assignments.map((assignment) =>
            Promise.resolve()
              .then(() => getAssignmentSubmissions(assignment._id ?? assignment.id))
              .then((submissions) => ({
                assignment,
                submissions,
              }))
              .catch((error) => {
                errors.push(`${classroomName}: submissions request failed for "${assignment.title || 'an assignment'}" (${apiErrorMessage(error)}).`);
                return null;
              })
          ));
          const pendingGrading = submissionResults
            .filter(Boolean)
            .flatMap(({ assignment, submissions }) => submissions
              .filter((submission) => submission.status !== 'graded')
              .map((submission) => ({
                id: submission._id ?? submission.id,
                name: submission.student?.name || 'Student',
                task: assignment.title || 'Assignment',
                submittedAt: submission.submittedAt,
                time: submission.submittedAt
                  ? new Date(submission.submittedAt).toLocaleDateString()
                  : 'Recently submitted',
              })));

          return { classroom, analytics, pendingGrading };
        }));
        if (ignore) return;

        const analyticsResults = results.filter((result) => result.analytics);
        const gradedCount = analyticsResults.reduce(
          (sum, result) => sum + (result.analytics.totalGradedSubmissions ?? 0),
          0
        );
        const weightedAverage = gradedCount
          ? analyticsResults.reduce((sum, result) =>
            sum + (result.analytics.averageGradedPercentage ?? 0)
              * (result.analytics.totalGradedSubmissions ?? 0), 0
          ) / gradedCount
          : null;
        setDashboardData({
          totalStudents: analyticsResults.reduce(
            (sum, result) => sum + (result.analytics.totalStudents ?? 0), 0
          ),
          pendingGrading: results
            .flatMap((result) => result.pendingGrading)
            .sort((a, b) => new Date(b.submittedAt ?? 0) - new Date(a.submittedAt ?? 0))
            .slice(0, 3),
          pendingGradingCount: results.reduce(
            (sum, result) => sum + result.pendingGrading.length, 0
          ),
          averagePercentage: weightedAverage == null ? null : Math.round(weightedAverage),
          classAverages: results
            .filter((result) => result.analytics)
            .map(({ classroom, analytics }) => ({
              id: classroom._id ?? classroom.id,
              name: classroom.name ?? classroom.title ?? 'Class',
              average: analytics.averageGradedPercentage,
            })),
        });
        setDataError([...new Set(errors)].join('\n'));
      } catch (err) {
        if (!ignore) {
          setDataError(`Could not process classroom dashboard data (${apiErrorMessage(err)}).`);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const metrics = [
    { label: 'Classrooms', value: classrooms.length, icon: BookOpen, tone: 'yellow' },
    { label: 'Student enrollments', value: dashboardData.totalStudents, icon: Users, tone: 'blue' },
    { label: 'To grade', value: dashboardData.pendingGradingCount, icon: FileCheck2, tone: 'red' },
    { label: 'Class average', value: dashboardData.averagePercentage == null ? '—' : `${dashboardData.averagePercentage}%`, icon: Award, tone: 'green' },
  ];

  const displayName = user?.name ? `Prof. ${user.name.split(' ')[0]}` : 'Professor';

  return (
    <div className="space-y-6 dashboard-stagger max-w-6xl mx-auto">
      <Topbar title="Teacher dashboard" subtitle="Classrooms, student progress, and work to review" />

      <HeroBanner
        variant="navy"
        eyebrow="TEACHER PORTAL"
        title={`Welcome back, ${displayName}!`}
        subtitle={`You have ${classrooms.length} active classrooms and ${dashboardData.pendingGradingCount} submissions awaiting grading.`}
        buttonText="Grade pending work"
        onButtonClick={() => navigate('/teacher/submissions')}
        icons={[BookOpen, Users, Award]}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <StatCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            icon={metric.icon}
            tone={metric.tone}
          />
        ))}
      </div>

<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => navigate('/teacher/create-class')}
          className="p-3.5 rounded-2xl border border-[#e5e7eb] dark:border-[#1f1f23] bg-white dark:bg-[#121214] hover:border-[#fde047] dark:hover:border-[#fde047] text-left transition group shadow-sm"
        >
          <PlusCircle className="w-5 h-5 text-indigo-500 mb-2 group-hover:scale-110 transition" />
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Create Class</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Generate join code</p>
        </button>

        <button
          onClick={() => navigate('/teacher/upload-material')}
          className="p-3.5 rounded-2xl border border-[#e5e7eb] dark:border-[#1f1f23] bg-white dark:bg-[#121214] hover:border-[#fde047] dark:hover:border-[#fde047] text-left transition group shadow-sm"
        >
          <Upload className="w-5 h-5 text-emerald-500 mb-2 group-hover:scale-110 transition" />
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Upload Notes</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">PDFs up to 10MB</p>
        </button>

        <button
          onClick={() => navigate('/teacher/create-assignment')}
          className="p-3.5 rounded-2xl border border-[#e5e7eb] dark:border-[#1f1f23] bg-white dark:bg-[#121214] hover:border-[#fde047] dark:hover:border-[#fde047] text-left transition group shadow-sm"
        >
          <BookOpen className="w-5 h-5 text-blue-500 mb-2 group-hover:scale-110 transition" />
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">New Assignment</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Set rubrics & due date</p>
        </button>

        <button
          onClick={() => navigate('/teacher/create-quiz')}
          className="p-3.5 rounded-2xl border border-[#e5e7eb] dark:border-[#1f1f23] bg-white dark:bg-[#121214] hover:border-[#fde047] dark:hover:border-[#fde047] text-left transition group shadow-sm"
        >
          <HelpCircle className="w-5 h-5 text-purple-500 mb-2 group-hover:scale-110 transition" />
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Create Quiz</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Timed MCQ builder</p>
        </button>
      </div>

<div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            My Classrooms ({classrooms.length})
          </h2>
          <button
            onClick={() => navigate('/teacher/create-class')}
            className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
          >
            Create another <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading your classrooms...</div>
        ) : loadError ? (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900 p-6 text-center bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-700 dark:text-rose-300">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
              className="mt-3 rounded-xl bg-card px-4 py-2 font-bold text-ink shadow-sm"
            >
              Try again
            </button>
          </div>
        ) : classrooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center bg-white dark:bg-[#121214] space-y-3">
            <FolderPlus className="w-10 h-10 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">No classrooms yet</p>
            <p className="text-xs text-slate-500">Create your first class to generate a join code for students.</p>
            <button
              onClick={() => navigate('/teacher/create-class')}
              className="px-4 py-2 rounded-xl bg-[#fde047] text-slate-950 font-bold text-xs"
            >
              Create Classroom
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {classrooms.map((c) => {
              const code = c.classCode || c.code || 'N/A';
              const studentCount = c.students?.length || c.enrolledCount || 0;

              return (
                <div
                  key={c._id || c.id}
                  className="rounded-2xl border border-[#e5e7eb] dark:border-[#1f1f23] bg-white dark:bg-[#121214] p-5 shadow-sm space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {c.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {c.description || `${studentCount} students enrolled`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {studentCount} Students
                    </span>
                    <button
                      onClick={() => handleCopyCode(code)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#fde047] hover:text-slate-950 text-slate-700 dark:text-slate-300 text-xs font-mono font-bold transition"
                      title="Click to copy join code"
                    >
                      {copiedCode === code ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> {code}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {dataError && (
        <div
          role="status"
          className="whitespace-pre-line rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <p>Some dashboard data could not be loaded:</p>
          <p className="mt-1">{dataError}</p>
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            className="mt-3 rounded-xl bg-card px-4 py-2 font-bold text-ink shadow-sm"
          >
            Retry dashboard data
          </button>
        </div>
      )}

<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-[#e5e7eb] dark:border-[#1f1f23] bg-white dark:bg-[#121214] p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Needs Grading (Recent Submissions)
            </h2>
            <button
              onClick={() => navigate('/teacher/submissions')}
              className="text-xs font-bold text-[#facc15] hover:underline"
            >
              View all
            </button>
          </div>

          <div className="space-y-2">
            {dashboardData.pendingGrading.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.task} &bull; {item.time}</p>
                </div>
                <button
                  onClick={() => navigate('/teacher/submissions')}
                  className="px-3 py-1.5 rounded-lg bg-[#fde047] text-slate-950 text-xs font-bold hover:bg-amber-400 transition"
                >
                  Grade
                </button>
              </div>
            ))}
            {!dashboardData.pendingGrading.length && !loading && (
              <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                No submissions are waiting to be graded.
              </p>
            )}
          </div>
        </div>

<div className="rounded-2xl border border-[#e5e7eb] dark:border-[#1f1f23] bg-white dark:bg-[#121214] p-5 space-y-4 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Class Averages
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Average graded assignment percentage</p>
          </div>

          <div className="space-y-3">
            {dashboardData.classAverages.length ? dashboardData.classAverages.map((item) => (
              <div key={item.id} className="space-y-1.5">
                <div className="flex justify-between gap-3 text-xs">
                  <span className="truncate font-semibold text-slate-700 dark:text-slate-300">{item.name}</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {item.average == null ? '—' : `${item.average}%`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-[#fde047]" style={{ width: `${item.average ?? 0}%` }} />
                </div>
              </div>
            )) : (
              <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                {loading ? 'Loading class results...' : 'No classrooms to report yet.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
