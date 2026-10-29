import { useEffect, useMemo, useState } from "react";
import { BarChart2, CheckCircle2, Users, ShieldAlert, Download } from "lucide-react";
import Card from "../../components/Card";
import Topbar from "../../components/Topbar";
import HeroBanner from "../../components/HeroBanner";
import RiskProfileModal from "../../components/RiskProfileModal";
import { fetchMyClassrooms } from "../../services/classroomService";
import {
  getTeacherClassroomAnalytics,
  getTeacherClassroomStudents,
  getTeacherRiskPredictions,
} from "../../services/analyticsService";

const classroomIdOf = (classroom) => classroom?._id ?? classroom?.id;

export default function ClassAnalytics() {
  const [classrooms, setClassrooms] = useState([]);
  const [classroomId, setClassroomId] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [students, setStudents] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [status, setStatus] = useState("loading");
  const [riskStatus, setRiskStatus] = useState("idle");
  const [error, setError] = useState("");
  const [riskError, setRiskError] = useState("");
  const [riskProfileStudent, setRiskProfileStudent] = useState(null);

  useEffect(() => {
    let active = true;
    fetchMyClassrooms()
      .then((items) => {
        if (!active) return;
        setClassrooms(items);
        setClassroomId(String(classroomIdOf(items[0]) ?? ""));
        if (!items.length) setStatus("ready");
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError.message || "Could not load classrooms.");
          setStatus("error");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!classroomId) return undefined;
    let active = true;
    Promise.resolve()
      .then(() => {
        setStatus("loading");
        setError("");
        setPredictions([]);
        setRiskStatus("idle");
      })
      .then(() => Promise.all([
        getTeacherClassroomAnalytics(classroomId),
        getTeacherClassroomStudents(classroomId),
      ]))
      .then(([classData, studentData]) => {
        if (!active) return;
        setAnalytics(classData);
        setStudents(studentData?.students ?? []);
        setStatus("ready");
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message || "Could not load class analytics.");
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [classroomId]);

  const selectedClassroom = classrooms.find(
    (classroom) => String(classroomIdOf(classroom)) === classroomId
  );
  const metrics = useMemo(() => [
    {
      label: "Class average",
      value: analytics?.averageGradedPercentage == null
        ? "—"
        : `${analytics.averageGradedPercentage}%`,
      icon: BarChart2,
    },
    {
      label: "Submission rate",
      value: analytics?.submissionRate == null ? "—" : `${analytics.submissionRate}%`,
      icon: CheckCircle2,
    },
    {
      label: "Students",
      value: analytics?.totalStudents ?? 0,
      icon: Users,
    },
    {
      label: "Assignments",
      value: analytics?.totalAssignments ?? 0,
      icon: ShieldAlert,
    },
  ], [analytics]);

  const loadPredictions = async () => {
    setRiskStatus("loading");
    setRiskError("");
    try {
      const response = await getTeacherRiskPredictions(classroomId);
      setPredictions(Array.isArray(response)
        ? response
        : response?.predictions ?? response?.students ?? []);
      setRiskStatus("ready");
    } catch (loadError) {
      setRiskError(loadError.message || "Could not load risk predictions.");
      setRiskStatus("error");
    }
  };

  const exportCsv = () => {
    const rows = [
      ["Student", "Email", "Assignments", "Submitted", "Graded", "Average percentage"],
      ...students.map((row) => [
        row.student?.name ?? "",
        row.student?.email ?? "",
        row.totalAssignments ?? 0,
        row.submittedAssignments ?? 0,
        row.gradedAssignments ?? 0,
        row.averagePercentage ?? "",
      ]),
    ];
    const csv = rows.map((row) => row.map((value) =>
      `"${String(value).replaceAll('"', '""')}"`
    ).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedClassroom?.name ?? "class"}-analytics.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const predictionByStudent = new Map(
    predictions.map((item) => [String(item.student?.id ?? item.student?._id), item])
  );

  return (
    <div className="space-y-6">
      <Topbar
        title="Class analytics"
        subtitle="Assignment performance and participation"
        backFallbackPath="/teacher/dashboard"
      />
      <HeroBanner
        variant="navy"
        title="Understand your classes"
        subtitle="Review assignment averages, submission progress, and students who may need support."
        icons={[BarChart2, Users, CheckCircle2]}
      />

      <Card className="p-4">
        <label htmlFor="analytics-classroom" className="mb-2 block text-xs font-bold">
          Classroom
        </label>
        <select
          id="analytics-classroom"
          value={classroomId}
          onChange={(event) => setClassroomId(event.target.value)}
          disabled={!classrooms.length}
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink sm:max-w-md"
        >
          {classrooms.length ? classrooms.map((classroom) => (
            <option key={classroomIdOf(classroom)} value={classroomIdOf(classroom)}>
              {classroom.name ?? classroom.title ?? "Classroom"}
            </option>
          )) : <option value="">No classrooms available</option>}
        </select>
      </Card>

      {error && <Card role="alert" className="p-4 text-sm text-tone-red-fg">{error}</Card>}
      {status === "loading" && <Card className="p-5 text-sm text-muted">Loading class analytics...</Card>}
      {status === "ready" && classroomId && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-muted">{selectedClassroom?.name ?? "Selected classroom"}</p>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!students.length}
              className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-bold disabled:opacity-50"
            >
              <Download size={16} /> Download student report
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {metrics.map((metric) => (
              <Card key={metric.label} className="flex items-center gap-3 p-4">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft"><metric.icon size={17} /></div>
                <div><p className="text-xs text-muted">{metric.label}</p><p className="text-xl font-extrabold">{metric.value}</p></div>
              </Card>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-base font-extrabold">Assignment activity</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <div className="rounded-xl border border-line bg-soft px-3 py-2.5 text-xs"><p className="text-muted">Submitted work</p><p className="mt-1 text-base font-extrabold">{analytics?.totalSubmissions ?? 0}/{analytics?.totalPossibleSubmissions ?? 0}</p></div>
                <div className="rounded-xl border border-line bg-soft px-3 py-2.5 text-xs"><p className="text-muted">Graded submissions</p><p className="mt-1 text-base font-extrabold">{analytics?.totalGradedSubmissions ?? 0}</p></div>
                <div className="rounded-xl border border-line bg-soft px-3 py-2.5 text-xs"><p className="text-muted">Not yet submitted</p><p className="mt-1 text-base font-extrabold">{analytics?.pendingSubmissions ?? 0}</p></div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold">Student risk predictions</h2>
                  <p className="mt-1 text-xs text-muted">Requires configured student profiles and a reachable ML service.</p>
                </div>
                <button
                  type="button"
                  onClick={loadPredictions}
                  disabled={riskStatus === "loading"}
                  className="rounded-xl bg-brand px-3 py-2 text-xs font-bold text-on-brand disabled:opacity-50"
                >
                  {riskStatus === "loading" ? "Loading..." : "Load predictions"}
                </button>
              </div>
              {riskError && <p role="alert" className="mt-3 text-xs text-tone-red-fg">{riskError}</p>}
              {riskStatus === "ready" && predictions.length === 0 && (
                <p className="mt-3 text-sm text-muted">No prediction records were returned.</p>
              )}
              {riskStatus === "ready" && predictions.length > 0 && (
                <div className="mt-4 space-y-2">
                  {predictions.map((item) => (
                    <div key={item.student?.id ?? item.student?._id} className="flex items-center justify-between gap-3 rounded-xl bg-soft p-3">
                      <div>
                        <p className="text-sm font-bold">{item.student?.name ?? "Student"}</p>
                        <p className="text-xs text-muted">
                          {item.status === "profile_required"
                            ? "Student profile needs configuration"
                            : `${item.prediction?.risk_probability == null ? "No probability" : `${Math.round(item.prediction.risk_probability * 100)}% risk probability`}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "profile_required" ? (
                          <button
                            type="button"
                            onClick={() => setRiskProfileStudent({ id: item.student?.id ?? item.student?._id, name: item.student?.name ?? "Student", email: item.student?.email ?? "" })}
                            className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:bg-card"
                          >
                            Configure ML Profile
                          </button>
                        ) : (
                          <span className="rounded-full bg-card px-3 py-1 text-xs font-bold">
                            {item.prediction?.risk_level ?? "Unavailable"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-line p-4">
              <h2 className="font-extrabold">Students</h2>
            </div>
            {!students.length ? (
              <p className="p-6 text-center text-sm text-muted">No students are enrolled in this classroom yet.</p>
            ) : (
              <div className="divide-y divide-line">
                {students.map((row) => {
                  const prediction = predictionByStudent.get(String(row.student?.id ?? row.student?._id));
                  return (
                    <div key={row.student?.id ?? row.student?._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div>
                        <p className="font-bold">{row.student?.name ?? "Student"}</p>
                        <p className="text-xs text-muted">{row.student?.email ?? ""}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted">
                        <span className="rounded-lg border border-line bg-soft px-2.5 py-1.5"><strong className="text-ink">{row.submittedAssignments ?? 0}/{row.totalAssignments ?? 0}</strong> submitted</span>
                        <span className="rounded-lg border border-line bg-soft px-2.5 py-1.5"><strong className="text-ink">{row.gradedAssignments ?? 0}</strong> graded</span>
                        <span className="rounded-lg border border-line bg-soft px-2.5 py-1.5"><strong className="text-ink">{row.averagePercentage == null ? "No grades" : `${row.averagePercentage}%`}</strong>{row.averagePercentage == null ? "" : " average"}</span>
                        {prediction?.status === "profile_required" ? (
                          <button
                            type="button"
                            onClick={() => setRiskProfileStudent({ id: row.student?.id ?? row.student?._id, name: row.student?.name ?? "Student", email: row.student?.email ?? "" })}
                            className="rounded-lg border border-line px-3 py-1 text-xs font-bold text-ink hover:bg-soft"
                          >
                            Configure ML Profile
                          </button>
                        ) : prediction ? (
                          <span className="font-bold text-ink">{prediction.prediction?.risk_level ?? prediction.status}</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
      {status === "ready" && !classroomId && (
        <Card className="p-6 text-sm text-muted">Create a classroom to view analytics.</Card>
      )}
      {riskProfileStudent && (
        <RiskProfileModal
          key={`${classroomId}-${riskProfileStudent.id}`}
          classroomId={classroomId}
          student={riskProfileStudent}
          onClose={() => setRiskProfileStudent(null)}
          onSaved={loadPredictions}
        />
      )}
    </div>
  );
}
