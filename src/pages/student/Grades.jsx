import { useEffect, useMemo, useState } from "react";
import {
  Award,
  TrendingUp,
  BookOpen,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import Topbar from "../../components/Topbar";
import HeroBanner from "../../components/HeroBanner";
import Card from "../../components/Card";
import { getStudentGradeData } from "../../services/gradesService";

const filters = ["All Results", "Assignments", "Quizzes"];

export default function Grades() {
  const [courses, setCourses] = useState([]);
  const [activeFilter, setActiveFilter] = useState("All Results");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getStudentGradeData()
      .then(({ courses: data }) => {
        if (!active) return;
        setCourses(data);
        setStatus("ready");
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message || "Could not load your grades.");
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  // every result (assignment + quiz) from every class, newest first
  const grades = useMemo(
    () =>
      courses
        .flatMap((course) => course.results)
        .sort((a, b) => b.time - a.time),
    [courses]
  );

  const totalScored = grades.reduce((sum, item) => sum + item.score, 0);
  const totalMarks = grades.reduce((sum, item) => sum + item.total, 0);
  const average = totalMarks ? Math.round((totalScored / totalMarks) * 100) : null;

  const filteredGrades = grades.filter((item) =>
    activeFilter === "Assignments"
      ? item.type === "assignment"
      : activeFilter === "Quizzes"
        ? item.type === "quiz"
        : true
  );

  const assignmentCount = grades.filter((g) => g.type === "assignment").length;
  const quizCount = grades.filter((g) => g.type === "quiz").length;

  const coursePerformance = courses.map((course) => ({
    ...course,
    percentage: course.total ? Math.round((course.scored / course.total) * 100) : null,
    count: course.results.length,
  }));

  return (
    <div className="space-y-5">
      <Topbar title="My Grades" subtitle="Track your assignment and quiz results" />
      <HeroBanner
        variant="navy"
        title="Every effort counts"
        subtitle="Review your scores, monitor class performance, and keep improving."
        icons={[Award, TrendingUp, BookOpen]}
      />

      {status === "loading" && <Card className="p-5 text-sm text-muted">Loading your grades...</Card>}
      {status === "error" && <Card role="alert" className="p-5 text-sm text-tone-red-fg">{error}</Card>}

      {status === "ready" && (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center justify-between"><p className="text-sm text-muted">Overall score</p><Award size={19} /></div>
              <p className="mt-3 text-3xl font-extrabold">{average == null ? "—" : `${average}%`}</p>
              <p className="mt-1 text-xs text-muted">Assignments + quizzes</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between"><p className="text-sm text-muted">Results</p><CheckCircle2 size={19} /></div>
              <p className="mt-3 text-3xl font-extrabold">{grades.length}</p>
              <p className="mt-1 text-xs text-muted">{assignmentCount} assignments · {quizCount} quizzes</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between"><p className="text-sm text-muted">Total marks</p><ClipboardList size={19} /></div>
              <p className="mt-3 text-3xl font-extrabold">{totalScored}/{totalMarks}</p>
              <p className="mt-1 text-xs text-muted">Marks earned</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between"><p className="text-sm text-muted">Classes</p><BookOpen size={19} /></div>
              <p className="mt-3 text-3xl font-extrabold">{courses.length}</p>
              <p className="mt-1 text-xs text-muted">With grade summaries</p>
            </Card>
          </section>

          <section>
            <h2 className="text-lg font-extrabold">Class performance</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {coursePerformance.map((course) => (
                <Card key={course.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-extrabold">{course.name}</p>
                      <p className="mt-1 text-xs text-muted">
                        {course.assignmentCount} assignments · {course.quizCount} quizzes
                      </p>
                    </div>
                    <span className="rounded-lg bg-brand-soft px-2 py-1 text-xs font-bold">{course.count} results</span>
                  </div>
                  <div className="mt-5 flex items-end justify-between">
                    <p className="text-2xl font-extrabold">{course.percentage == null ? "—" : `${course.percentage}%`}</p>
                    <p className="text-xs text-muted">{course.scored}/{course.total} marks</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-soft">
                    <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${course.percentage ?? 0}%` }} />
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold">Grade history</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {filters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                    activeFilter === filter ? "bg-brand text-on-brand" : "border border-line bg-card hover:bg-soft"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <Card className="mt-3 overflow-hidden">
              {filteredGrades.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted">No results available yet.</p>
              ) : (
                <div className="divide-y divide-line">
                  {filteredGrades.map((item) => {
                    const percentage = item.total ? Math.round((item.score / item.total) * 100) : 0;
                    return (
                      <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-bold">{item.title}</p>
                          <p className="mt-1 text-xs text-muted">
                            {item.course} · {item.type === "quiz" ? "Quiz" : "Assignment"} · {item.date}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-extrabold">{item.score}/{item.total}</span>
                          <span className={`min-w-16 rounded-lg px-2 py-1 text-center text-xs font-extrabold ${
                            percentage >= 80 ? "bg-tone-green text-tone-green-fg" : percentage >= 60 ? "bg-tone-yellow text-tone-yellow-fg" : "bg-tone-red text-tone-red-fg"
                          }`}>{percentage}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </section>
        </>
      )}
    </div>
  );
}