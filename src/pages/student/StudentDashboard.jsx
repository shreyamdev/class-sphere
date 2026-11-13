import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Award, BookOpen, ClipboardList, Clock, Megaphone } from "lucide-react";
import Topbar from "../../components/Topbar";
import HeroBanner from "../../components/HeroBanner";
import Card from "../../components/Card";
import StatCard from "../../components/StatCard";
import ProfilePanel from "../../components/ProfilePanel";
import AnnouncementCard from "../../components/AnnouncementCard";
import { useAuth } from "../../context/authContext";
import { fetchMyClassrooms } from "../../services/classroomService";
import { getClassroomAnnouncements } from "../../services/announcementService";
import {
  getStudentClassroomAnalytics,
  getStudentOverview,
} from "../../services/analyticsService";

const classIdOf = (classroom) => classroom?._id ?? classroom?.id;

function asDateLabel(value) {
  if (!value) return "No due date";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "No due date"
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState("all");
  const [data, setData] = useState({
    classrooms: [],
    overview: null,
    courseData: [],
    assignments: [],
    announcements: [],
  });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([fetchMyClassrooms(), getStudentOverview()])
      .then(async ([classrooms, overview]) => {
        const details = await Promise.all(classrooms.map(async (classroom) => {
          const id = classIdOf(classroom);
          const [analytics, announcements] = await Promise.all([
            getStudentClassroomAnalytics(id),
            getClassroomAnnouncements(id),
          ]);
          return { classroom, analytics, announcements };
        }));
        if (!active) return;

        const courseData = details.map(({ classroom, analytics }, index) => {
          const assignments = analytics?.assignments ?? [];
          const completed = analytics?.completedAssignments ?? 0;
          const total = analytics?.totalAssignments ?? assignments.length;
          const progress = total ? Math.round((completed / total) * 100) : 0;
          return {
            id: classIdOf(classroom),
            name: classroom.name ?? classroom.title ?? "Classroom",
            teacher: classroom.teacher?.name ?? classroom.owner?.name ?? "Teacher",
            tag: classroom.subject ?? classroom.semesterSection ?? "Classroom",
            assignments: total,
            quizzes: 0,
            progress,
            color: ["yellow", "blue", "green"][index % 3],
            status: progress === 100 ? "completed" : "active",
          };
        });
        const assignmentRows = details.flatMap(({ classroom, analytics }) =>
          (analytics?.assignments ?? []).map((item) => ({
            id: item.assignmentId,
            title: item.title ?? "Assignment",
            course: classroom.name ?? classroom.title ?? "Classroom",
            dueDate: item.dueDate,
            due: asDateLabel(item.dueDate),
            marks: item.maxMarks ?? 0,
            score: item.marksObtained,
            status: item.status ?? "pending",
            feedback: item.feedback ?? "",
          }))
        );
        const announcementItems = details.flatMap(({ classroom, announcements }) =>
          announcements.map((item) => ({
            id: item._id ?? item.id,
            title: item.title ?? "Announcement",
            by: `${item.teacher?.name ?? item.teacherName ?? "Teacher"}, ${classroom.name ?? classroom.title ?? "Classroom"}`,
            createdAt: item.createdAt,
          }))
        ).sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));

        setData({
          classrooms,
          overview,
          courseData,
          assignments: assignmentRows,
          announcements: announcementItems.slice(0, 4),
        });
        setStatus("ready");
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message || "Could not load your learning dashboard.");
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleCourses = useMemo(
    () => data.courseData.filter((course) => tab === "all" || course.status === tab),
    [data.courseData, tab]
  );
  const pendingCount = data.overview?.pendingAssignments ?? 0;
  const average = data.overview?.averagePercentage;
  const name = user?.name ?? "Student";
  const firstName = name.trim().split(/\s+/)[0];

  return (
    <div className="grid gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="dashboard-stagger space-y-5">
        <Topbar title={`Hello, ${firstName}`} subtitle="Your classes and work at a glance" />

        <HeroBanner
          variant="navy"
          eyebrow="YOUR LEARNING SPACE"
          title={pendingCount ? `${pendingCount} assignments need your attention` : "Keep learning, one class at a time"}
          subtitle="Check your classes, due work, and feedback from teachers."
          buttonText="View assignments"
          onButtonClick={() => navigate("/student/assignments")}
          icons={[BookOpen, ClipboardList, Award]}
        />

        {status === "loading" && (
          <Card className="p-5 text-sm text-muted">Loading your dashboard...</Card>
        )}
        {status === "error" && (
          <Card role="alert" className="p-5 text-sm text-tone-red-fg">{error}</Card>
        )}

        {status === "ready" && (
          <>
            <section className="grid grid-cols-2 gap-3 min-[1200px]:grid-cols-4">
              <StatCard label="Classes" value={data.overview?.totalClassrooms ?? data.classrooms.length} icon={BookOpen} tone="yellow" />
              <StatCard label="Pending work" value={pendingCount} icon={ClipboardList} tone="red" />
              <StatCard label="Average score" value={average == null ? "—" : `${average}%`} icon={Award} tone="green" />
              <StatCard label="Completed work" value={data.overview?.completedAssignments ?? 0} icon={Clock} tone="blue" />
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-extrabold">My Classes</h2>
                <Link to="/student/classes" className="text-sm font-bold text-muted hover:text-ink">View all</Link>
              </div>
              <div className="mt-2 flex gap-4 border-b border-line">
                {[
                  { key: "all", label: "All" },
                  { key: "active", label: "Active" },
                  { key: "completed", label: "Completed" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className={`-mb-px border-b-2 pb-1 text-sm font-semibold ${
                      tab === item.key ? "border-ink text-ink" : "border-transparent text-muted"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {visibleCourses.length === 0 ? (
                <Card className="mt-3 p-5 text-sm text-muted">
                  {data.courseData.length ? "No classes match this filter." : "Join a class to see your learning here."}
                </Card>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {visibleCourses.map((course) => (
                    <Link key={course.id} to={`/student/classes/${course.id}`}>
                      <Card className="h-full p-4 transition hover:border-brand">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-extrabold">{course.name}</h3>
                            <p className="mt-1 text-xs text-muted">{course.teacher} · {course.tag}</p>
                          </div>
                          <BookOpen size={18} className="shrink-0 text-muted" />
                        </div>
                        <p className="mt-4 text-xs text-muted">
                          {course.assignments} assignments · {course.progress}% submitted
                        </p>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-soft">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${course.progress}%` }} />
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-extrabold">Assignments</h2>
                <Link to="/student/assignments" className="text-sm font-bold text-muted hover:text-ink">View all</Link>
              </div>
              {data.assignments.length === 0 ? (
                <Card className="mt-3 p-5 text-sm text-muted">No assignments have been shared yet.</Card>
              ) : (
                <Card className="mt-3 divide-y divide-line">
                  {data.assignments.slice(0, 5).map((assignment) => (
                    <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div>
                        <p className="font-bold">{assignment.title}</p>
                        <p className="mt-1 text-xs text-muted">{assignment.course} · Due {assignment.due}</p>
                      </div>
                      <span className="rounded-lg bg-soft px-3 py-1 text-xs font-bold capitalize text-ink">
                        {assignment.status}
                      </span>
                    </div>
                  ))}
                </Card>
              )}
            </section>
          </>
        )}
      </div>

      <aside className="dashboard-stagger space-y-5 [scrollbar-width:thin] min-[1100px]:sticky min-[1100px]:top-6 min-[1100px]:max-h-[calc(100vh-3rem)] min-[1100px]:self-start min-[1100px]:overflow-y-auto">
        <ProfilePanel name={name} email={user?.email ?? ""} />
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Megaphone size={18} />
            <h2 className="font-extrabold">Class updates</h2>
          </div>
          {status === "ready" ? (
            <div className="mt-3">
              <AnnouncementCard items={data.announcements} />
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted">Updates will appear here.</p>
          )}
        </Card>
        <Card className="p-4">
          <h2 className="font-extrabold">Keep moving forward</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Review your grades and teacher feedback to see where you can improve.
          </p>
          <Link to="/student/grades" className="mt-3 inline-flex rounded-lg bg-brand px-3 py-2 text-xs font-bold text-on-brand">
            View my grades
          </Link>
        </Card>
      </aside>
    </div>
  );
}
