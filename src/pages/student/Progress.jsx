import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  Clock,
  TrendingUp,
  Target,
} from "lucide-react";
import Topbar from "../../components/Topbar";
import HeroBanner from "../../components/HeroBanner";
import Card from "../../components/Card";
import { getStudentGradeData } from "../../services/gradesService";

export default function Progress() {
  const [courses, setCourses] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getStudentGradeData()
      .then(({ courses: data }) => {
        if (!active) return;
        setCourses(
          data.map((course) => {
            // work = assignments + published quizzes of this class
            const total = course.totalAssignments + course.quizzes.length;
            const completed = course.completedAssignments + course.quizzesTaken;
            return {
              ...course,
              total,
              completed,
              percentage: total ? Math.round((completed / total) * 100) : 0,
            };
          })
        );
        setStatus("ready");
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message || "Could not load your progress.");
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    const sum = (key) => courses.reduce((acc, c) => acc + c[key], 0);
    const totalAssignments = sum("totalAssignments");
    const completedAssignments = sum("completedAssignments");
    const totalQuizzes = courses.reduce((acc, c) => acc + c.quizzes.length, 0);
    const quizzesTaken = sum("quizzesTaken");
    const total = totalAssignments + totalQuizzes;
    const completed = completedAssignments + quizzesTaken;
    return {
      totalAssignments,
      completedAssignments,
      totalQuizzes,
      quizzesTaken,
      pending: total - completed,
      completion: total ? Math.round((completed / total) * 100) : 0,
    };
  }, [courses]);

  // one activity list: assignments (with status) + quizzes (taken / not taken)
  const activity = useMemo(
    () =>
      courses.flatMap((course) => [
        ...course.assignments.map((a) => ({
          id: `a-${a.assignmentId}`,
          title: a.title ?? "Assignment",
          course: course.name,
          kind: "Assignment",
          status: a.status ?? "pending",
          marks: a.status === "graded" ? `${a.marksObtained}/${a.maxMarks} marks` : null,
        })),
        ...course.quizzes.map((quiz) => {
          const result = course.results.find((r) => r.id === `quiz-${quiz.id}`);
          return {
            id: `q-${quiz.id}`,
            title: quiz.title,
            course: course.name,
            kind: "Quiz",
            status: result ? "completed" : "pending",
            marks: result ? `${result.score}/${result.total} marks` : null,
          };
        }),
      ]),
    [courses]
  );

  return (
    <div className="space-y-5">
      <Topbar title="My Progress" subtitle="Track your assignment and quiz activity" />
      <HeroBanner
        variant="navy"
        title="Look how far you've come!"
        subtitle="See your assignment and quiz progress across enrolled classes."
        icons={[TrendingUp, Target, BookOpen]}
      />

      {status === "loading" && <Card className="p-5 text-sm text-muted">Loading your progress...</Card>}
      {status === "error" && <Card role="alert" className="p-5 text-sm text-tone-red-fg">{error}</Card>}

      {status === "ready" && (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2"><p className="text-sm text-muted">Overall completion</p><BarChart3 size={19} /></div>
              <p className="mt-3 text-3xl font-extrabold">{totals.completion}%</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-brand" style={{ width: `${totals.completion}%` }} /></div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2"><p className="text-sm text-muted">Assignments done</p><CheckCircle2 size={19} /></div>
              <p className="mt-3 text-3xl font-extrabold">{totals.completedAssignments}/{totals.totalAssignments}</p>
              <p className="mt-2 text-xs text-muted">Submitted or graded</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2"><p className="text-sm text-muted">Quizzes taken</p><CircleHelp size={19} /></div>
              <p className="mt-3 text-3xl font-extrabold">{totals.quizzesTaken}/{totals.totalQuizzes}</p>
              <p className="mt-2 text-xs text-muted">Published quizzes attempted</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2"><p className="text-sm text-muted">Pending work</p><Clock size={19} /></div>
              <p className="mt-3 text-3xl font-extrabold">{totals.pending}</p>
              <p className="mt-2 text-xs text-muted">Assignments + quizzes left</p>
            </Card>
          </section>

          <section>
            <div className="mb-3">
              <h2 className="text-lg font-extrabold">Class-wise progress</h2>
              <p className="mt-1 text-sm text-muted">Completion counts submitted assignments and attempted quizzes.</p>
            </div>
            {courses.length === 0 ? (
              <Card className="p-5 text-sm text-muted">Join a classroom to see your progress.</Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {courses.map((course) => (
                  <Card key={course.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-extrabold">{course.name}</h3>
                        <p className="mt-1 text-xs text-muted">{course.teacher}</p>
                        <p className="mt-2 text-xs text-muted">
                          {course.completedAssignments}/{course.totalAssignments} assignments · {course.quizzesTaken}/{course.quizzes.length} quizzes
                        </p>
                      </div>
                      <span className="rounded-lg bg-brand-soft px-2 py-1 text-xs font-bold">
                        {course.completed}/{course.total}
                      </span>
                    </div>
                    <div className="mt-5 flex items-center justify-between">
                      <span className="text-sm text-muted">Completion</span>
                      <span className="text-lg font-extrabold">{course.percentage}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-soft">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${course.percentage}%` }} />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-extrabold">Activity overview</h2>
            <Card className="overflow-hidden">
              {activity.length === 0 ? (
                <p className="p-5 text-sm text-muted">No assignments or quizzes have been shared yet.</p>
              ) : (
                <div className="divide-y divide-line">
                  {activity.map((item) => (
                    <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-bold">{item.title}</p>
                        <p className="mt-1 text-xs text-muted">{item.course} · {item.kind}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {item.marks && <span className="text-sm font-bold">{item.marks}</span>}
                        <span className={`rounded-lg px-2.5 py-1 text-xs font-bold capitalize ${
                          item.status === "graded" || item.status === "completed"
                            ? "bg-tone-green text-tone-green-fg"
                            : item.status === "submitted"
                              ? "bg-brand-soft"
                              : "bg-tone-yellow text-tone-yellow-fg"
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>
        </>
      )}
    </div>
  );
}